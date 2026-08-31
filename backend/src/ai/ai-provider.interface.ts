export interface AnalyseWorkItemInput {
  title: string;
  description: string;
}

export interface WorkItemAnalysis {
  category: string;
  priority: string;
  summary: string;
  recommendedAction: string;
}

export interface AiProvider {
  analyse(input: AnalyseWorkItemInput): Promise<WorkItemAnalysis>;
}
