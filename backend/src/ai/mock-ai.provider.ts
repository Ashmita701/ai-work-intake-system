import { Injectable } from '@nestjs/common';

import {
  AiProvider,
  AnalyseWorkItemInput,
  WorkItemAnalysis,
} from './ai-provider.interface';

type MockAiMode =
  | 'success'
  | 'failure'
  | 'malformed'
  | 'unexpected'
  | 'timeout';

const successfulAnalysis: WorkItemAnalysis = {
  category: 'DOCUMENT_REQUEST',
  priority: 'HIGH',
  summary: 'The applicant needs to provide their latest payslip.',
  recommendedAction: 'Request the missing payslip from the applicant.',
};

@Injectable()
export class MockAiProvider implements AiProvider {
  async analyse(_: AnalyseWorkItemInput): Promise<WorkItemAnalysis> {
    switch (this.getMode()) {
      case 'failure':
        throw new Error('Mock AI provider failure.');
      case 'malformed':
        return {
          category: 'DOCUMENT_REQUEST',
          priority: 'HIGH',
          summary: 'The applicant needs to provide their latest payslip.',
        } as WorkItemAnalysis;
      case 'unexpected':
        return 42 as unknown as WorkItemAnalysis;
      case 'timeout':
        await new Promise((resolve) => setTimeout(resolve, 11_000));
        return successfulAnalysis;
      case 'success':
        return successfulAnalysis;
    }
  }

  private getMode(): MockAiMode {
    const mode = process.env.MOCK_AI_MODE;

    return mode === 'failure' ||
      mode === 'malformed' ||
      mode === 'unexpected' ||
      mode === 'timeout'
      ? mode
      : 'success';
  }
}
