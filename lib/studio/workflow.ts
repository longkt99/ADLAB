// ============================================
// Studio Workflow Configuration
// ============================================
// 3-step system-driven workflow (user never manually switches)
// Step transitions are automatic based on editor state

export type WorkflowStep = 'brief' | 'draft' | 'review';

export interface WorkflowStepDefinition {
  id: WorkflowStep;
  label: string;
  description: string;
  placeholder: string;
}

/**
 * 3-step content creation workflow (system-driven)
 *
 * Step 1: Soạn brief - User defining intent (no AI output yet)
 * Step 2: Bản nháp - AI has produced output, no issues
 * Step 3: Chỉnh & duyệt - Issues/suggestions present OR reviewing before approval
 */
export const WORKFLOW_STEPS: WorkflowStepDefinition[] = [
  {
    id: 'brief',
    label: 'Brief',
    description: 'Mô tả nội dung',
    placeholder: 'Nội dung, sản phẩm, hoặc mục tiêu',
  },
  {
    id: 'draft',
    label: 'Nháp',
    description: 'Nội dung sẵn sàng',
    placeholder: 'Xem nội dung nháp',
  },
  {
    id: 'review',
    label: 'Rà soát',
    description: 'Xem lại và hoàn tất',
    placeholder: 'Đánh giá và xác nhận',
  },
];

/**
 * Get a workflow step by its ID
 */
export function getWorkflowStepById(id: WorkflowStep): WorkflowStepDefinition | undefined {
  return WORKFLOW_STEPS.find((step) => step.id === id);
}

/**
 * Get the default workflow step (brief)
 */
export function getDefaultWorkflowStep(): WorkflowStep {
  return 'brief';
}
