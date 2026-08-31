import { MockAiProvider } from './mock-ai.provider';

describe('MockAiProvider', () => {
  const input = {
    title: 'Missing income document',
    description: 'The applicant has not provided their latest payslip.',
  };
  const originalMode = process.env.MOCK_AI_MODE;

  beforeEach(() => {
    delete process.env.MOCK_AI_MODE;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    if (originalMode === undefined) {
      delete process.env.MOCK_AI_MODE;
    } else {
      process.env.MOCK_AI_MODE = originalMode;
    }
  });

  it('returns the expected structured analysis by default', async () => {
    const provider = new MockAiProvider();

    await expect(provider.analyse(input)).resolves.toEqual({
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: 'The applicant needs to provide their latest payslip.',
      recommendedAction: 'Request the missing payslip from the applicant.',
    });
  });

  it('throws when configured for failure', async () => {
    process.env.MOCK_AI_MODE = 'failure';

    await expect(new MockAiProvider().analyse(input)).rejects.toThrow(
      'Mock AI provider failure.',
    );
  });

  it('returns incomplete data when configured for malformed output', async () => {
    process.env.MOCK_AI_MODE = 'malformed';

    await expect(new MockAiProvider().analyse(input)).resolves.toEqual({
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: 'The applicant needs to provide their latest payslip.',
    });
  });

  it('returns an unexpected value when configured for unexpected output', async () => {
    process.env.MOCK_AI_MODE = 'unexpected';

    await expect(new MockAiProvider().analyse(input)).resolves.toBe(42);
  });

  it('delays longer than the service timeout when configured for timeout', async () => {
    jest.useFakeTimers();
    process.env.MOCK_AI_MODE = 'timeout';
    const analysisPromise = new MockAiProvider().analyse(input);
    let resolved = false;
    void analysisPromise.then(() => {
      resolved = true;
    });

    await jest.advanceTimersByTimeAsync(10_999);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await expect(analysisPromise).resolves.toEqual({
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: 'The applicant needs to provide their latest payslip.',
      recommendedAction: 'Request the missing payslip from the applicant.',
    });
  });
});
