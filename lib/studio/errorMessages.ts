// ============================================
// Error Messages - User-facing AI error mapper
// ============================================
// Maps reasonCode from llmExecutor to user-friendly VN/EN messages.
// No logic changes, only message display.
// ============================================

/**
 * Known reason codes from llmExecutor and validation guards.
 */
export type AiReasonCode =
  | 'EMPTY_USER_PROMPT'
  | 'MISSING_SYSTEM'
  | 'INVALID_META'
  | 'BINDING_MISMATCH'
  | 'REWRITE_NO_CONTEXT'
  | 'REWRITE_ANCHOR_MISMATCH'
  | 'REWRITE_DIFF_EXCEEDED'
  | 'EDIT_SCOPE_REQUIRED'
  | 'EXECUTION_BLOCKED'
  | 'UNKNOWN';

/**
 * Error message mapping for each reason code.
 */
const ERROR_MESSAGES: Record<AiReasonCode, { vi: string; en: string }> = {
  REWRITE_NO_CONTEXT: {
    vi: 'Bạn muốn viết lại bài nào? Hãy chọn một bài/draft trước.',
    en: 'Which post do you want to rewrite? Please select a draft first.',
  },
  REWRITE_ANCHOR_MISMATCH: {
    vi: 'Mình không thể viết lại vì cấu trúc đoạn bị lệch. Thử lại (giữ nguyên số đoạn) nhé.',
    en: 'Rewrite failed because paragraph structure drifted. Try again while keeping the same paragraph count/order.',
  },
  REWRITE_DIFF_EXCEEDED: {
    vi: 'Bản viết lại bị thay đổi quá mạnh so với bản gốc. Hãy thử lại với mức chỉnh nhẹ hơn.',
    en: 'Rewrite changed too much compared to the original. Try a lighter edit.',
  },
  BINDING_MISMATCH: {
    vi: 'Có lỗi liên kết yêu cầu với nội dung gốc. Vui lòng thử lại.',
    en: 'Request binding error. Please try again.',
  },
  EDIT_SCOPE_REQUIRED: {
    vi: 'Bạn muốn chỉnh phần nào: Hook / Body / CTA?',
    en: 'Which part do you want to edit: Hook / Body / CTA?',
  },
  EXECUTION_BLOCKED: {
    vi: 'Bạn không có quyền thực thi hành động này.',
    en: "You don't have permission to execute this action.",
  },
  EMPTY_USER_PROMPT: {
    vi: 'Vui lòng nhập nội dung trước khi gửi.',
    en: 'Please enter content before sending.',
  },
  MISSING_SYSTEM: {
    vi: 'Lỗi cấu hình hệ thống. Vui lòng thử lại.',
    en: 'System configuration error. Please try again.',
  },
  INVALID_META: {
    vi: 'Dữ liệu yêu cầu không hợp lệ. Vui lòng thử lại.',
    en: 'Invalid request data. Please try again.',
  },
  UNKNOWN: {
    vi: 'Không thể thực hiện yêu cầu. Vui lòng thử lại.',
    en: 'Could not complete the request. Please try again.',
  },
};

/**
 * Get user-facing error message for AI failures.
 *
 * @param params.lang - Language for the message ('vi' | 'en')
 * @param params.reasonCode - The reasonCode from ExecutionResult.debugInfo
 * @param params.fallback - Optional fallback message if reasonCode is unknown
 * @returns User-friendly error message in the specified language
 */
export function getUserFacingAiError(params: {
  lang: 'vi' | 'en';
  reasonCode?: string | null;
  fallback?: string;
}): string {
  const { lang, reasonCode, fallback } = params;

  // If we have a known reason code, use the mapped message
  if (reasonCode && reasonCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[reasonCode as AiReasonCode][lang];
  }

  // Use fallback if provided
  if (fallback) {
    return fallback;
  }

  // Default fallback
  return ERROR_MESSAGES.UNKNOWN[lang];
}

/**
 * Check if a reason code is known.
 */
export function isKnownReasonCode(code: string | undefined | null): code is AiReasonCode {
  return !!code && code in ERROR_MESSAGES;
}
