export async function handleQueueBatch(batch: MessageBatch<unknown>, _env: Env, _ctx: ExecutionContext): Promise<void> {
  for (const message of batch.messages) message.ack();
}
