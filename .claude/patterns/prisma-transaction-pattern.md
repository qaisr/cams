# Prisma Transaction Pattern

## Overview
Safe transaction patterns for Prisma ORM ensuring atomicity, consistency, and rollback on errors.

## Transaction Types

### 1. Sequential Operations ($transaction)
```typescript
// apps/api/src/orders/orders.service.ts
async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        total: 0,
      },
    });

    // 2. Create order items
    let total = 0;
    for (const item of items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        },
      });
      total += item.price * item.quantity;

      // 3. Decrement inventory
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 4. Update order total
    return tx.order.update({
      where: { id: order.id },
      data: { total },
    });
  });
}
```

### 2. Batch Operations (transactional array)
```typescript
async transferFunds(fromAccountId: string, toAccountId: string, amount: number): Promise<void> {
  await this.prisma.$transaction([
    // Debit from source account
    this.prisma.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    }),
    // Credit to destination account
    this.prisma.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
    }),
  ]);
}
```

### 3. Optimistic Locking (Version Field)
```prisma
model Account {
  id      String @id @default(uuid())
  balance Decimal
  version Int    @default(0) // Optimistic lock
}
```

```typescript
async withdraw(accountId: string, amount: number): Promise<Account> {
  const account = await this.prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  if (account.balance < amount) {
    throw new BadRequestException('Insufficient funds');
  }

  try {
    return await this.prisma.account.update({
      where: {
        id: accountId,
        version: account.version, // Optimistic lock check
      },
      data: {
        balance: { decrement: amount },
        version: { increment: 1 },
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new ConflictException('Account was modified by another transaction');
    }
    throw error;
  }
}
```

### 4. Pessimistic Locking (SELECT FOR UPDATE)
```typescript
async reserveInventory(productId: string, quantity: number): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Lock row for update
    const product = await tx.$queryRaw<Product[]>`
      SELECT * FROM "Product"
      WHERE id = ${productId}
      FOR UPDATE
    `;

    if (!product[0] || product[0].stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });
  });
}
```

### 5. Long-Running Transactions (with timeout)
```typescript
async complexOperation(): Promise<void> {
  await this.prisma.$transaction(
    async (tx) => {
      // Long-running operations
      await tx.user.updateMany({ data: { migrated: true } });
      await tx.log.createMany({ data: logs });
    },
    {
      maxWait: 10000, // 10s max wait to acquire transaction
      timeout: 30000, // 30s max transaction duration
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}
```

## Error Handling

```typescript
async safeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await this.prisma.$transaction(operation);
  } catch (error) {
    if (error.code === 'P2034') {
      // Transaction conflict (optimistic locking)
      throw new ConflictException('Resource was modified by another request');
    }
    if (error.code === 'P2028') {
      // Transaction timeout
      throw new RequestTimeoutException('Transaction took too long');
    }
    throw error;
  }
}
```

## Testing Transactions

```typescript
describe('OrdersService', () => {
  it('rolls back transaction on error', async () => {
    const spy = jest.spyOn(prisma.product, 'update').mockRejectedValueOnce(new Error('Out of stock'));

    await expect(
      service.createOrder('user-1', [{ productId: 'prod-1', quantity: 1, price: 100 }])
    ).rejects.toThrow();

    // Verify no order was created (rollback)
    const orders = await prisma.order.findMany({ where: { userId: 'user-1' } });
    expect(orders).toHaveLength(0);
  });
});
```

## Best Practices
1. **Keep Transactions Short**: Minimize operations inside transaction
2. **Avoid External API Calls**: No HTTP requests inside transactions
3. **Use Optimistic Locking**: Prefer optimistic over pessimistic for high concurrency
4. **Set Timeouts**: Always configure `maxWait` and `timeout`
5. **Idempotency**: Design transactions to be retryable
6. **Error Handling**: Catch and translate Prisma error codes

## Anti-Patterns
- ❌ Long-running transactions (> 5 seconds)
- ❌ External API calls inside transactions
- ❌ Nested transactions (Prisma doesn't support)
- ❌ Missing error handling
- ❌ No timeout configuration

## Related
- `.claude/standards/database-standards.md`
- `.claude/agents/database-analyst.md`

## Token Optimization

**Load when** when implementing atomic operations / interactive transactions. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
