import { prisma } from "@/lib/prisma";
import type { MovementDirection, MovementType } from "@/generated/prisma/client";

interface ApplyMovementInput {
  direction: MovementDirection;
  type: MovementType;
  quantity: number; // sempre positivo; o sinal é dado por `direction`
  stockItemId: string;
  project?: string | null;
  notes?: string | null;
  orderId?: string | null;
  areaId?: string | null;
  performedById: string;
}

/**
 * Grava uma Movement e atualiza StockItem.quantity numa única transação —
 * o saldo nunca é calculado apenas no cliente. Lança erro se a saída deixaria
 * o estoque negativo.
 */
export async function applyMovement(input: ApplyMovementInput) {
  return prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findUniqueOrThrow({ where: { id: input.stockItemId } });
    const delta = input.direction === "ENTRADA" ? input.quantity : -input.quantity;

    if (stockItem.quantity + delta < 0) {
      throw new Error(
        `Estoque insuficiente: "${stockItem.name}" tem ${stockItem.quantity} disponível, saída pede ${input.quantity}.`
      );
    }

    const updatedItem = await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { quantity: { increment: delta }, updatedById: input.performedById },
    });

    // Snapshot do custo do item no momento da retirada, para o valor histórico
    // não mudar se o custo cadastrado no item for atualizado depois.
    const unitCost = input.areaId && stockItem.lastCost ? stockItem.lastCost : null;
    const totalCost = unitCost ? unitCost.times(input.quantity) : null;

    const movement = await tx.movement.create({
      data: {
        direction: input.direction,
        type: input.type,
        quantity: input.quantity,
        project: input.project || null,
        notes: input.notes || null,
        stockItemId: input.stockItemId,
        orderId: input.orderId || null,
        areaId: input.areaId || null,
        unitCost,
        totalCost,
        performedById: input.performedById,
      },
    });

    return { movement, updatedItem };
  });
}

interface UpdateMovementInput {
  direction: MovementDirection;
  type: MovementType;
  quantity: number;
  stockItemId: string;
  project?: string | null;
  notes?: string | null;
  performedById: string; // admin que está editando, grava como updatedById do(s) item(ns) afetado(s)
}

/**
 * Edita uma movimentação manual (sem orderId/kitOutputId/areaId — ver
 * `isMovementLocked()`) revertendo o efeito antigo no saldo do item original
 * e aplicando o novo efeito (possivelmente em outro item), tudo numa única
 * transação. Rejeita se qualquer um dos dois passos deixaria algum item com
 * saldo negativo.
 */
export async function updateMovement(id: string, input: UpdateMovementInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.movement.findUniqueOrThrow({ where: { id } });

    const oldDelta = existing.direction === "ENTRADA" ? existing.quantity : -existing.quantity;
    const revertedItem = await tx.stockItem.update({
      where: { id: existing.stockItemId },
      data: { quantity: { decrement: oldDelta }, updatedById: input.performedById },
    });
    if (revertedItem.quantity < 0) {
      throw new Error(
        `Não é possível editar: reverter o efeito original deixaria "${revertedItem.name}" com saldo negativo.`
      );
    }

    const newDelta = input.direction === "ENTRADA" ? input.quantity : -input.quantity;
    const targetItem =
      input.stockItemId === existing.stockItemId
        ? revertedItem
        : await tx.stockItem.findUniqueOrThrow({ where: { id: input.stockItemId } });
    if (targetItem.quantity + newDelta < 0) {
      throw new Error(`Estoque insuficiente: "${targetItem.name}" tem ${targetItem.quantity} disponível.`);
    }
    await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { quantity: { increment: newDelta }, updatedById: input.performedById },
    });

    return tx.movement.update({
      where: { id },
      data: {
        direction: input.direction,
        type: input.type,
        quantity: input.quantity,
        stockItemId: input.stockItemId,
        project: input.project ?? null,
        notes: input.notes ?? null,
      },
    });
  });
}

/**
 * Exclui uma movimentação manual revertendo seu efeito no saldo do item numa
 * única transação. Rejeita se reverter deixaria o item com saldo negativo.
 */
export async function deleteMovement(id: string, performedById: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.movement.findUniqueOrThrow({ where: { id } });
    const delta = existing.direction === "ENTRADA" ? existing.quantity : -existing.quantity;

    const item = await tx.stockItem.update({
      where: { id: existing.stockItemId },
      data: { quantity: { decrement: delta }, updatedById: performedById },
    });
    if (item.quantity < 0) {
      throw new Error(`Não é possível excluir: reverter esta movimentação deixaria "${item.name}" com saldo negativo.`);
    }

    await tx.movement.delete({ where: { id } });
  });
}

/**
 * Movimentações geradas automaticamente por outro fluxo (entrega de pedido,
 * saída de kit, retirada de consumo por área) não podem ser editadas/excluídas
 * aqui — fazer isso desincronizaria o estado do pedido/kit/área de origem.
 */
export function isMovementLocked(m: { orderId: string | null; kitOutputId: string | null; areaId: string | null }) {
  return Boolean(m.orderId || m.kitOutputId || m.areaId);
}

interface UpdateAreaWithdrawalInput {
  areaId: string;
  stockItemId: string;
  quantity: number;
  project?: string | null;
  notes?: string | null;
  performedById: string;
}

/**
 * Edita uma retirada de Consumo por área (sempre SAIDA/CONSUMO_INTERNO —
 * direção e tipo não são editáveis aqui, mesma regra da criação em
 * `POST /api/area-withdrawals`). Reverte o efeito antigo no saldo e aplica o
 * novo, na mesma transação. Se o item retirado mudar, o snapshot de custo
 * (`unitCost`) é recalculado a partir do `lastCost` atual do novo item; se o
 * item continuar o mesmo, o `unitCost` original é preservado (só o
 * `totalCost` muda, proporcional à nova quantidade) — o snapshot só deve
 * mudar quando a correção realmente troca a origem do custo.
 */
export async function updateAreaWithdrawal(id: string, input: UpdateAreaWithdrawalInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.movement.findUniqueOrThrow({ where: { id } });
    if (!existing.areaId) {
      throw new Error("Esta movimentação não é uma retirada de Consumo por área.");
    }

    const oldDelta = existing.direction === "ENTRADA" ? existing.quantity : -existing.quantity;
    const revertedItem = await tx.stockItem.update({
      where: { id: existing.stockItemId },
      data: { quantity: { decrement: oldDelta }, updatedById: input.performedById },
    });
    if (revertedItem.quantity < 0) {
      throw new Error(
        `Não é possível editar: reverter o efeito original deixaria "${revertedItem.name}" com saldo negativo.`
      );
    }

    const targetItem =
      input.stockItemId === existing.stockItemId
        ? revertedItem
        : await tx.stockItem.findUniqueOrThrow({ where: { id: input.stockItemId } });
    const newDelta = -input.quantity; // retirada por área é sempre SAIDA
    if (targetItem.quantity + newDelta < 0) {
      throw new Error(`Estoque insuficiente: "${targetItem.name}" tem ${targetItem.quantity} disponível.`);
    }
    await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { quantity: { increment: newDelta }, updatedById: input.performedById },
    });

    const unitCost = input.stockItemId === existing.stockItemId ? existing.unitCost : targetItem.lastCost;
    const totalCost = unitCost ? unitCost.times(input.quantity) : null;

    return tx.movement.update({
      where: { id },
      data: {
        areaId: input.areaId,
        stockItemId: input.stockItemId,
        quantity: input.quantity,
        project: input.project ?? null,
        notes: input.notes ?? null,
        unitCost,
        totalCost,
      },
    });
  });
}

interface RegisterKitOutputInput {
  kitId: string;
  quantity: number; // número de kits retirados
  areaId: string; // área responsável pela retirada, para contabilizar em Consumo por área
  project?: string | null;
  notes?: string | null;
  performedById: string;
}

/**
 * Cria um KitOutput e uma Movement (SAIDA/KIT) por item componente do kit,
 * decrementando cada StockItem — tudo numa única transação. Cada movimentação
 * carrega a área da retirada e um snapshot de `unitCost`/`totalCost` (mesma
 * regra de `applyMovement`), para que a saída de kit também apareça e some
 * corretamente em Consumo por área.
 */
export async function registerKitOutput(input: RegisterKitOutputInput) {
  return prisma.$transaction(async (tx) => {
    const kit = await tx.kit.findUniqueOrThrow({
      where: { id: input.kitId },
      include: { items: { include: { stockItem: true } } },
    });

    for (const line of kit.items) {
      const needed = line.quantity * input.quantity;
      if (line.stockItem.quantity < needed) {
        throw new Error(
          `Estoque insuficiente para "${line.stockItem.name}": disponível ${line.stockItem.quantity}, necessário ${needed}.`
        );
      }
    }

    const kitOutput = await tx.kitOutput.create({
      data: {
        kitId: kit.id,
        quantity: input.quantity,
        project: input.project || null,
        notes: input.notes || `Saída de ${input.quantity}x ${kit.name}`,
        performedById: input.performedById,
      },
    });

    for (const line of kit.items) {
      const needed = line.quantity * input.quantity;
      await tx.stockItem.update({
        where: { id: line.stockItemId },
        data: { quantity: { decrement: needed }, updatedById: input.performedById },
      });
      const unitCost = line.stockItem.lastCost ?? null;
      const totalCost = unitCost ? unitCost.times(needed) : null;
      await tx.movement.create({
        data: {
          direction: "SAIDA",
          type: "KIT",
          quantity: needed,
          project: input.project || kit.name,
          notes: input.notes || `Saída de ${input.quantity}x ${kit.name}`,
          stockItemId: line.stockItemId,
          kitOutputId: kitOutput.id,
          areaId: input.areaId,
          unitCost,
          totalCost,
          performedById: input.performedById,
        },
      });
    }

    return kitOutput;
  });
}

/**
 * Devolve ao estoque parte (ou tudo) do que uma saída de kit retirou — caso
 * comum: retiraram 30 kits para um evento, sobraram 10 sem uso, devolvem só
 * essas 10. `returnQuantity` é sempre em unidades de kit (não de item
 * componente).
 *
 * A proporção por item é recalculada a partir do estado atual da própria
 * Movement (`m.quantity / kitOutput.quantity`), não da receita atual do Kit
 * (`KitItem.quantity`) — assim, se o kit for editado depois da retirada, ou
 * se essa saída já tiver sofrido uma devolução parcial anterior, o cálculo
 * continua correto (é o mesmo princípio de snapshot já usado para
 * `unitCost`/`totalCost`).
 *
 * Quando `returnQuantity` fecha a saída inteira (== `kitOutput.quantity`),
 * remove as Movements e o próprio KitOutput — mesmo resultado de antes,
 * quando só existia desfazer tudo. Diferente de `updateMovement`/
 * `deleteMovement`, não precisa validar saldo negativo: devolver estoque
 * nunca subtrai.
 */
export async function returnKitOutputQuantity(id: string, returnQuantity: number, performedById: string) {
  return prisma.$transaction(async (tx) => {
    const kitOutput = await tx.kitOutput.findUniqueOrThrow({ where: { id } });

    if (!Number.isInteger(returnQuantity) || returnQuantity < 1 || returnQuantity > kitOutput.quantity) {
      throw new Error(`Quantidade inválida: informe um número inteiro entre 1 e ${kitOutput.quantity}.`);
    }

    const movements = await tx.movement.findMany({ where: { kitOutputId: id } });
    const isFullReturn = returnQuantity === kitOutput.quantity;

    for (const m of movements) {
      const portion = (m.quantity * returnQuantity) / kitOutput.quantity;
      if (!Number.isInteger(portion)) {
        throw new Error("Não foi possível calcular a devolução proporcional para um dos itens do kit.");
      }

      await tx.stockItem.update({
        where: { id: m.stockItemId },
        data: { quantity: { increment: portion }, updatedById: performedById },
      });

      if (isFullReturn) {
        await tx.movement.delete({ where: { id: m.id } });
      } else {
        const newQuantity = m.quantity - portion;
        await tx.movement.update({
          where: { id: m.id },
          data: { quantity: newQuantity, totalCost: m.unitCost ? m.unitCost.times(newQuantity) : null },
        });
      }
    }

    if (isFullReturn) {
      await tx.kitOutput.delete({ where: { id } });
    } else {
      await tx.kitOutput.update({ where: { id }, data: { quantity: kitOutput.quantity - returnQuantity } });
    }

    return { isFullReturn, remainingQuantity: isFullReturn ? 0 : kitOutput.quantity - returnQuantity };
  });
}
