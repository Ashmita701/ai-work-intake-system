import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateWorkItemStatusDto } from './update-work-item-status.dto';

describe('UpdateWorkItemStatusDto', () => {
  it('accepts COMPLETED', async () => {
    const dto = plainToInstance(UpdateWorkItemStatusDto, {
      status: 'COMPLETED',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['RECEIVED', 'ANALYSING', 'READY_FOR_REVIEW', 'FAILED'])(
    'rejects %s because only COMPLETED may be requested',
    async (status) => {
      const dto = plainToInstance(UpdateWorkItemStatusDto, { status });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );

  it('rejects an invalid status input', async () => {
    const dto = plainToInstance(UpdateWorkItemStatusDto, {
      status: 'NOT_A_STATUS',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
