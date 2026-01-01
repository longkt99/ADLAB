// ============================================
// Vietnamese Dictionary (Source of Truth)
// ============================================
// This dictionary defines the structure that English must match

export const viDictionary = {
  // Common UI elements
  common: {
    loading: 'Đang tải...',
    save: 'Lưu',
    cancel: 'Hủy',
    close: 'Đóng',
    view: 'Xem',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    search: 'Tìm kiếm',
    filter: 'Lọc',
    all: 'Tất cả',
    new: 'Mới',
    create: 'Tạo',
    update: 'Cập nhật',
    previous: 'Trước',
    next: 'Tiếp',
    page: 'Trang',
    of: 'của',
    showing: 'Hiển thị',
    event: 'sự kiện',
    events: 'sự kiện',
    today: 'Hôm nay',
    viewFullPost: 'Xem toàn bộ bài viết',
    clearAllFilters: 'Xóa tất cả bộ lọc',
    confirm: 'Xác nhận',
    clear: 'Xóa',
    saving: 'Đang lưu...',
    updating: 'Đang cập nhật...',
    deleting: 'Đang xóa...',
    variant: 'phiên bản',
    variants: 'phiên bản',
    characters: 'ký tự',
    chars: 'ký tự',
  },

  // Navigation items
  navigation: {
    posts: 'Bài viết',
    calendar: 'Lịch',
    newPost: 'Tạo bài mới',
    studio: 'AI Studio',
    viewCalendar: 'Xem lịch',
    contentMachine: 'Content Machine',
    multiPlatformCMS: 'CMS đa nền tảng',
  },

  // User-related strings
  user: {
    defaultName: 'Người dùng',
    defaultEmail: 'nguoidung@contentmachine.app',
  },

  // Accessibility labels
  accessibility: {
    toggleLanguage: 'Chuyển đổi ngôn ngữ',
    toggleTheme: 'Chuyển đổi giao diện',
    removeImage: 'Xóa hình ảnh',
    openSidebar: 'Mở thanh điều hướng',
    closeSidebar: 'Đóng thanh điều hướng',
  },

  // Post-related strings
  posts: {
    title: 'Bài viết',
    description: 'Quản lý nội dung của bạn trên',
    post: 'bài viết',
    postPlural: 'bài viết',
    actions: {
      newPost: 'Tạo bài mới',
      viewCalendar: 'Xem lịch',
      view: 'Xem',
    },
    table: {
      title: 'Tiêu đề',
      status: 'Trạng thái',
      platforms: 'Nền tảng',
      created: 'Ngày tạo',
      scheduled: 'Đã lên lịch',
      actions: 'Thao tác',
    },
    filters: {
      searchPlaceholder: 'Tìm kiếm bài viết...',
      allStatuses: 'Tất cả trạng thái',
      allPlatforms: 'Tất cả nền tảng',
      noResultsTitle: 'Không tìm thấy bài viết',
      noResultsDescription: 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm',
    },
    empty: {
      title: 'Chưa có bài viết nào',
      description: 'Tạo bài viết đầu tiên để bắt đầu quản lý nội dung đa nền tảng với các phiên bản do AI hỗ trợ',
      cta: 'Tạo bài viết đầu tiên',
    },
    platformPills: {
      noPlatforms: 'Không có nền tảng',
    },
    toast: {
      deleteSuccess: 'Đã xóa bài viết thành công',
      deleteFailed: 'Không thể xóa bài viết',
    },
  },

  // Calendar-related strings
  calendar: {
    title: 'Lịch',
    subtitle: 'Xem và quản lý nội dung đã lên lịch và đã xuất bản',

    toolbar: {
      today: 'Hôm nay',
      thisWeek: 'Tuần này',
      previousMonth: 'Tháng trước',
      nextMonth: 'Tháng sau',
      previousPeriod: 'Kỳ trước',
      nextPeriod: 'Kỳ sau',
      clearDateRange: 'Xóa phạm vi ngày',
    },

    search: {
      placeholder: 'Tìm kiếm theo tiêu đề hoặc nội dung...',
    },

    filters: {
      platformLabel: 'Nền tảng',
      statusLabel: 'Trạng thái',
      allPlatforms: 'Tất cả nền tảng',
      allStatuses: 'Tất cả trạng thái',
    },

    viewMode: {
      label: 'Chế độ xem:',
      month: 'Tháng',
      week: 'Tuần',
      agenda: 'Lịch trình',
    },

    weekdays: {
      sun: 'CN',
      mon: 'T2',
      tue: 'T3',
      wed: 'T4',
      thu: 'T5',
      fri: 'T6',
      sat: 'T7',
    },

    stats: {
      showing: 'Hiển thị',
      eventSingular: 'sự kiện',
      eventPlural: 'sự kiện',
      in: 'trong',
      filteredFrom: '(đã lọc từ',
      total: 'tổng cộng)',
      clearAllFilters: 'Xóa tất cả bộ lọc',
    },

    loading: {
      message: 'Đang tải lịch...',
    },

    legend: {
      title: 'Chú thích',
      scheduled: 'Đã lên lịch',
      published: 'Đã xuất bản',
      today: 'Hôm nay',
    },

    dayCell: {
      more: 'thêm',
    },

    weekView: {
      title: 'Xem theo tuần',
    },

    agendaView: {
      title: 'Xem lịch trình',
      noEvents: 'Không tìm thấy sự kiện nào',
    },

    dayEventsModal: {
      events: 'sự kiện',
      close: 'Đóng',
      previous: 'Trước',
      next: 'Sau',
      page: 'Trang',
      of: 'của',
    },

    eventModal: {
      title: 'Chi tiết sự kiện',
      postTitle: 'Tiêu đề bài viết',
      content: 'Nội dung',
      scheduledFor: 'Đã lên lịch vào',
      publishedAt: 'Đã xuất bản lúc',
      viewFullPost: 'Xem toàn bộ bài viết',
      close: 'Đóng',
    },
  },

  // Status labels
  status: {
    draft: 'Bản nháp',
    scheduled: 'Đã lên lịch',
    published: 'Đã xuất bản',
    failed: 'Lỗi',
    approved: 'Đã phê duyệt',
  },

  // Platform labels (keeping English names as per requirements)
  platforms: {
    // Platform names remain in English
  },

  // Post Editor (Create/Edit Form)
  postEditor: {
    // Labels
    titleLabel: 'Tiêu đề *',
    contentLabel: 'Nội dung *',
    targetPlatformsLabel: 'Nền tảng mục tiêu',
    statusLabel: 'Trạng thái',
    scheduledTimeLabel: 'Thời gian lên lịch',

    // Placeholders
    titlePlaceholder: 'Nhập tiêu đề bài viết',
    contentPlaceholder: 'Nhập nội dung cơ bản của bạn ở đây. Bạn có thể tạo các phiên bản cho từng nền tảng sau.',

    // Helper text
    characterCount: 'Số ký tự:',

    // Buttons
    cancel: 'Hủy',
    saving: 'Đang lưu...',
    create: 'Tạo bài viết',
    update: 'Cập nhật bài viết',

    // Page headers
    newTitle: 'Tạo bài viết mới',
    newSubtitle: 'Tạo nội dung cơ bản của bạn. Bạn có thể tạo các phiên bản cho từng nền tảng sau khi lưu.',
    editTitle: 'Chỉnh sửa bài viết',
    editSubtitle: 'Cập nhật nội dung và cài đặt bài viết của bạn',
  },

  // PostForm Component
  postForm: {
    error: {
      failedToSave: 'Không thể lưu bài viết',
    },

    preview: {
      userName: 'Tên người dùng',
      username: 'tenngdung',
      justNow: 'Vừa xong',
      world: '🌎',
      seeMore: 'Xem thêm',
      more: 'thêm',
      like: 'Thích',
      comment: 'Bình luận',
      share: 'Chia sẻ',
      reply: 'Trả lời',
      repost: 'Đăng lại',
      view: 'Xem',
      professionalTitle: 'Chức danh',
      seeMoreLinkedIn: '...xem thêm',
      targetPlatforms: 'Nền tảng mục tiêu:',
      status: 'Trạng thái:',
      scheduled: 'Đã lên lịch:',
      characters: 'Ký tự:',
    },

    toolbar: {
      newPost: 'Bài viết mới',
      editPost: 'Chỉnh sửa bài viết',
      charactersCount: 'ký tự',
      autoSaved: 'Đã tự động lưu',
      hidePreview: 'Ẩn xem trước',
      showPreview: 'Hiện xem trước',
      cancel: 'Hủy',
      saved: '✓ Đã lưu',
      saving: 'Đang lưu...',
      createPost: 'Tạo bài viết',
      saveChanges: 'Lưu thay đổi',
    },

    sections: {
      content: 'Nội dung',
      media: 'Hình ảnh',
      addMedia: 'Thêm hình ảnh',
      cover: 'Ảnh bìa',
      multiImageHelp: 'Chọn nhiều hình ảnh. Hình đầu tiên sẽ được dùng làm ảnh bìa.',
      targetPlatforms: 'Nền tảng mục tiêu',
      targetPlatformsDescription: 'Chọn nền tảng mà bài viết này hướng đến',
      publishingSettings: 'Cài đặt xuất bản',
      publishingSettingsDescription: 'Cấu hình trạng thái và lịch trình',
      livePreview: 'Xem trước trực tiếp',
      realTime: 'Thời gian thực',
    },

    empty: {
      tip: '💡 Mẹo: Sử dụng nút "Tạo phiên bản" ở trên để tạo nội dung tối ưu cho từng nền tảng',
    },
  },

  // Post Detail Page
  postDetail: {
    backToPosts: '← Quay lại danh sách',
    createdAt: 'Ngày tạo:',
    scheduledFor: '📅 Đã lên lịch:',
    content: 'Nội dung',
    characterCount: 'Số ký tự:',
    targetPlatforms: 'Nền tảng mục tiêu',
    editPost: 'Chỉnh sửa bài viết',
    generatedVariants: 'Các phiên bản đã tạo',

    error: {
      notFound: 'Không tìm thấy bài viết',
      notFoundDescription: 'Bài viết bạn đang tìm không tồn tại hoặc đã bị xóa.',
    },

    variantCount: 'phiên bản đã tạo',
    variantCountPlural: 'phiên bản đã tạo',

    stats: {
      title: 'Thống kê phiên bản',
      totalVariants: 'Tổng số phiên bản',
      draft: 'Bản nháp',
      approved: 'Đã phê duyệt',
      scheduled: 'Đã lên lịch',
      published: 'Đã xuất bản',
      completionRate: 'Tỷ lệ hoàn thành',
      variantsPublished: 'trong tổng số {total} phiên bản đã xuất bản',
    },

    actions: {
      backToPosts: '← Quay lại danh sách',
      editPost: '✏️ Chỉnh sửa bài viết',
    },
  },

  // Variants (VariantList Component)
  variants: {
    item: {
      copy: 'Sao chép',
      copied: '✓ Đã sao chép',
      markApproved: 'Đánh dấu đã phê duyệt',
      schedulePublish: 'Lên lịch xuất bản',
      markPublished: 'Đánh dấu đã xuất bản',
      updating: 'Đang cập nhật...',
      publishing: 'Đang xuất bản...',
      scheduling: 'Đang lên lịch...',
      chars: 'ký tự',
      deleting: 'Đang xóa...',
      delete: '🗑️ Xóa',
      updated: '✓ Đã cập nhật!',
    },

    bulk: {
      selectAll: 'Chọn tất cả',
      deselectAll: 'Bỏ chọn tất cả',
      selected: 'đã chọn',
      approveSelected: 'Phê duyệt đã chọn',
      scheduleSelected: 'Lên lịch đã chọn',
      publishSelected: 'Xuất bản đã chọn',
      clear: 'Xóa',
      noSelection: 'Chưa chọn phiên bản nào',
      deleteSelected: '🗑️ Xóa đã chọn',
      confirmDelete: 'Bạn có chắc chắn muốn xóa {count} phiên bản? Hành động này không thể hoàn tác.',
      deleteSuccess: 'Đã xóa thành công {count} phiên bản',
      deleteFailed: 'Không thể xóa các phiên bản',
    },

    scheduleModal: {
      title: 'Lên lịch xuất bản',
      singleDescription: 'Chọn thời gian bạn muốn phiên bản này được xuất bản tự động.',
      bulkDescription: 'Chọn thời gian bạn muốn các phiên bản này được xuất bản tự động.',
      bulkTitle: 'Lên lịch {count} phiên bản',
      dateTimeLabel: 'Ngày & Giờ',
      schedule: 'Lên lịch',
      scheduleAll: 'Lên lịch tất cả',
      cancel: 'Hủy',
    },

    empty: {
      title: 'Chưa có phiên bản nào được tạo',
      description: 'Nhấp vào "Tạo phiên bản" để tạo các phiên bản cho từng nền tảng',
    },

    status: {
      scheduledLabel: '📅 Đã lên lịch:',
      publishedLabel: '✓ Đã xuất bản:',
      createdLabel: 'Ngày tạo:',
      viewOnPlatform: 'Xem trên nền tảng →',
      charLimitWarning: '⚠️ Nội dung vượt quá giới hạn ký tự của nền tảng',
    },

    alerts: {
      selectAtLeastOne: 'Vui lòng chọn ít nhất một phiên bản',
      selectDateTime: 'Vui lòng chọn ngày và giờ',
      confirmApprove: 'Phê duyệt {count} phiên bản đã chọn?',
      confirmPublish: 'Xuất bản {count} phiên bản đã chọn ngay lập tức?',
      confirmDeleteSingle: 'Bạn có chắc chắn muốn xóa phiên bản này? Hành động này không thể hoàn tác.',
      approveSuccess: '✅ Đã phê duyệt thành công {count} phiên bản',
      publishSuccess: '✅ Đã xuất bản thành công {count} phiên bản',
      scheduleSuccess: '✅ Đã lên lịch thành công {count} phiên bản',
      updateStatusFailed: 'Không thể cập nhật trạng thái',
      scheduleFailed: 'Không thể lên lịch phiên bản',
      bulkActionFailed: 'Không thể thực hiện thao tác hàng loạt',
      deleteFailed: 'Không thể xóa phiên bản',
    },
  },

  // Generate Variants Dialog
  generateVariants: {
    button: '✨ Tạo phiên bản',
    generating: '⚙️ Đang tạo phiên bản...',
    title: 'Tạo phiên bản cho nền tảng',
    subtitle: 'Chọn nền tảng và ngôn ngữ để AI tạo nội dung phù hợp',

    language: {
      label: 'Ngôn ngữ',
      vi: 'Tiếng Việt',
      en: 'Tiếng Anh',
      both: 'Cả hai (Song ngữ)',
      bothDescription: 'Tiếng Việt + Tiếng Anh với dấu phân cách',
    },

    platforms: {
      label: 'Nền tảng mục tiêu',
      selected: 'đã chọn',
      selectAll: 'Chọn tất cả',
      clear: 'Xóa',
      noSelectionHint: 'Không có nền tảng nào được chọn - sẽ tạo cho tất cả nền tảng',
    },

    cancel: 'Hủy',
    submit: '✨ Tạo phiên bản',
    success: '✅ Đã tạo thành công {count} phiên bản!',
    error: 'Không thể tạo phiên bản',
  },

  // Delete Post Dialog
  deletePost: {
    button: 'Xóa bài viết',
    confirmButton: 'Xác nhận xóa',
    deleting: 'Đang xóa...',
    cancel: 'Hủy',
    error: 'Không thể xóa bài viết',
  },

  // Studio (AI Content Creation)
  studio: {
    // Hero section
    hero: {
      title: 'Studio Nội Dung AI',
      subtitle: 'Tạo nội dung chiến lược với sức mạnh AI.',
      subtitleCta: 'Chọn kịch bản bên dưới để bắt đầu.',
    },

    // Scenario selection
    scenarios: {
      title: 'Chọn kịch bản của bạn',
    },

    // Chat workspace
    workspace: {
      title: 'Không gian viết với AI',
      subtitle: 'Tạo, chỉnh sửa và duyệt nội dung',
      selectTone: 'Chọn tone giọng',
      templatesButton: '🎬 Kịch bản',
      you: 'Bạn',
      aiDraft: 'Bản nháp AI v',
      approved: 'Đã duyệt',
      aiThinking: 'AI đang xử lý...',
      clearInput: 'Xoá',
      clearConversation: 'Xoá hội thoại',
      sendButton: 'Gửi',
      keyboardHint: '⏎ gửi tin, ⇧⏎ xuống dòng mới',
      emptyState: 'Bắt đầu bằng cách chọn tone giọng và kịch bản, sau đó mô tả nội dung bạn muốn tạo',
      tooltipApprove: 'Phê duyệt',
      tooltipCopy: 'Sao chép',
      tooltipSaveToLibrary: 'Lưu vào thư viện',
      savedToLibrary: 'Đã lưu vào thư viện',
      saveFailed: 'Không thể lưu',
    },

    // Library
    library: {
      title: 'Thư viện AI',
      loading: 'Đang tải...',
      empty: 'Chưa có bài đã lưu',
      loaded: 'Đã tải từ thư viện',
    },

    // Content Machine Engine Templates
    engineTemplates: {
      title: 'Template Engine',
      clearTemplate: 'Xóa kịch bản',
      useDefault: 'Dùng mặc định',
      defaultEngine: 'Engine Mặc định',
      helperText: 'Kịch bản áp dụng quy trình 5 bước Content Machine với định dạng cụ thể.',
    },

    // Script Library Modal
    scriptLibrary: {
      title: 'Thư viện Kịch Bản',
    },

    // Template Metadata (Localized Names & Descriptions)
    templateMeta: {
      social_caption: {
        name: 'Caption Mạng Xã Hội',
        description: 'Tạo caption hấp dẫn cho Instagram, Facebook, TikTok với hook thu hút, storytelling, và CTA rõ ràng',
      },
      idea_list_advanced: {
        name: 'Ý Tưởng Nội Dung (Nâng Cao)',
        description: 'Tạo danh sách ý tưởng nội dung chất lượng cao với insight sâu, góc nhìn rõ ràng, hook cảm xúc và lý do phù hợp với khán giả',
      },
      strategic_content_ideas: {
        name: 'Ý Tưởng Chiến Lược',
        description: 'Tạo ý tưởng chiến lược bao gồm trụ cột nội dung, khái niệm series, và lãnh thổ narrative cho kế hoạch nội dung dài hạn',
      },
      storytelling: {
        name: 'Nội Dung Kể Chuyện',
        description: 'Tạo nội dung kể chuyện hấp dẫn với cốt truyện rõ ràng, cộng hưởng cảm xúc, và bài học ý nghĩa',
      },
      ad_copy: {
        name: 'Quảng Cáo Chuyển Đổi',
        description: 'Tạo nội dung quảng cáo chuyển đổi cao với giá trị rõ ràng, tính cấp bách, và CTA mạnh mẽ',
      },
      categories: {
        ideation: 'Ý tưởng chiến lược',
        content_creation: 'Tạo nội dung',
        analytical: 'Phân tích',
        optimization: 'Tối ưu nội dung',
      },
      categoryDescriptions: {
        ideation: 'Khám phá chủ đề, phát triển chiến lược nội dung dài hạn',
        content_creation: 'Viết caption, story, quảng cáo với định dạng tối ưu cho từng nền tảng',
        analytical: 'Đánh giá và phân tích nội dung hiện có để cải thiện hiệu quả',
        optimization: 'Cải tiến SEO, khả năng tiếp cận và tương tác của nội dung',
      },
      complexity: {
        beginner: 'Cơ bản',
        intermediate: 'Trung cấp',
        advanced: 'Nâng cao',
      },
      actions: {
        viewAll: 'Xem tất cả',
        useScript: 'Dùng kịch bản này',
        viewDetails: 'Xem chi tiết',
        useDefault: 'Mặc định',
        clearDefault: 'Xóa',
        scriptLabel: 'Kịch bản:',
      },
      modes: {
        abstract: 'Trừu tượng - Không giả định format, platform hay cấu trúc cụ thể',
        structured: 'Có cấu trúc - Sử dụng format và platform do người dùng chỉ định',
        generic: 'Chung - Mô tả tiến trình không gắn với platform cụ thể',
      },
      labels: {
        defaultMode: 'Mặc định:',
        supportedPlatforms: 'Nền tảng hỗ trợ',
        executionModes: 'Chế độ thực thi',
        engineInfo: 'Ultra Precision Engine v2.3.1 · 3 chế độ A/B/C (Trừu tượng · Có cấu trúc · Chung)',
        viewAllScripts: 'Xem tất cả kịch bản →',
      },
    },

    // Prompt Templates (Nội dung kịch bản dành cho người dùng)
    prompts: {
      seoCompetitorAnalysis: {
        userTemplate: `Phân tích chiến lược SEO của đối thủ cạnh tranh trong lĩnh vực {{niche}}.

**Từ Khóa Mục Tiêu Của Tôi:**
{{keywords}}

**Website Đối Thủ:**
{{competitorUrls}}

**Chủ Đề Nội Dung Hiện Tại Của Tôi:**
{{currentTopics}}

Vui lòng cung cấp:
1. **Phân Tích Nội Dung Đối Thủ**: Họ đang xếp hạng cho những chủ đề nào mà tôi đang thiếu?
2. **Khoảng Trống Từ Khóa**: Từ khóa tiềm năng cao mà họ xếp hạng nhưng tôi không
3. **Đánh Giá Chất Lượng Nội Dung**: Độ sâu nội dung của họ so với tôi như thế nào?
4. **Đề Xuất Hành Động**: 5-7 nội dung cụ thể tôi nên tạo để cạnh tranh

{{toneHints}}`,
      },
      seoKeywordOpportunities: {
        userTemplate: `Tìm cơ hội từ khóa cho nội dung của tôi trong lĩnh vực {{niche}}.

**Đối Tượng Mục Tiêu:**
{{audience}}

**Chủ Đề Chính Tôi Đề Cập:**
{{topics}}

**Từ Khóa Hiện Tại Tôi Nhắm Đến:**
{{existingKeywords}}

Vui lòng đề xuất:
1. **Từ Khóa Chính** (3-5 mục tiêu tiềm năng cao)
2. **Biến Thể Từ Khóa Dài** (10-15 cụm từ cụ thể)
3. **Từ Khóa Dạng Câu Hỏi** (5-7 từ khóa kiểu "làm thế nào", "là gì", v.v.)
4. **Ý Tưởng Nội Dung** cho mỗi cụm từ khóa

{{toneHints}}`,
      },
      seoStrategicContentIdeas: {
        userTemplate: `Tạo kế hoạch nội dung chiến lược trong {{duration}} tập trung vào tăng trưởng SEO.

**Lĩnh Vực/Ngành:**
{{niche}}

**Từ Khóa Mục Tiêu:**
{{keywords}}

**Điểm Đau Của Đối Tượng:**
{{painPoints}}

**Mục Tiêu Kinh Doanh:**
{{goals}}

Vui lòng cung cấp:
1. **Nội Dung Trụ Cột** (2-3 bài toàn diện là nền tảng)
2. **Nội Dung Cụm** (8-10 bài viết hỗ trợ liên kết đến trụ cột)
3. **Chiến Thắng Nhanh** (5 chủ đề cạnh tranh thấp, giá trị cao)
4. **Lịch Nội Dung** với lịch xuất bản và chiến lược liên kết nội bộ

{{toneHints}}`,
      },
      seoContentRefresh: {
        userTemplate: `Tôi cần làm mới và tối ưu nội dung hiện có của mình về: {{topic}}

**URL Hiện Tại:**
{{url}}

**Xếp Hạng/Hiệu Suất Hiện Tại:**
{{currentPerformance}}

**Từ Khóa Mục Tiêu:**
{{targetKeywords}}

**Nội Dung Đối Thủ Tôi Đang Cạnh Tranh:**
{{competitorUrls}}

Vui lòng phân tích và đề xuất:
1. **Khoảng Trống Nội Dung**: Tôi đang thiếu gì so với đối thủ xếp hạng cao nhất?
2. **Bổ Sung Từ Khóa**: Từ khóa mới cần tích hợp tự nhiên
3. **Cải Tiến Cấu Trúc**: Tiêu đề, phần, định dạng
4. **Đề Xuất Đa Phương Tiện**: Hình ảnh, video, infographic cần thêm
5. **Liên Kết Nội Bộ**: Tôi nên liên kết đến/từ trang nào khác của mình?

{{toneHints}}`,
      },
      contentPillarCluster: {
        userTemplate: `Thiết kế chiến lược nội dung trụ cột-cụm cho: {{mainTopic}}

**Đối Tượng Mục Tiêu:**
{{audience}}

**Mục Tiêu Kinh Doanh:**
{{objectives}}

**Tài Sản Nội Dung Hiện Có:**
{{existingContent}}

**Khung Thời Gian Triển Khai:**
{{timeframe}}

Vui lòng tạo:
1. **Dàn Ý Trang Trụ Cột**: Cấu trúc hướng dẫn toàn diện (H2, H3, phần chính)
2. **Chủ Đề Nội Dung Cụm**: 10-15 bài viết hỗ trợ liên kết ngược về trụ cột
3. **Sơ Đồ Liên Kết Nội Bộ**: Cách tất cả các phần kết nối
4. **Đề Xuất Độ Sâu Nội Dung**: Số từ, đa phương tiện, tính tương tác
5. **Lịch Xuất Bản**: Thứ tự và thời gian tối ưu

{{toneHints}}`,
      },
      content30DayPlan: {
        userTemplate: `Tạo kế hoạch nội dung 30 ngày cho {{platform}} của tôi.

**Đối Tượng Mục Tiêu:**
{{audience}}

**Mục Tiêu Nội Dung:**
{{goals}}

**Chủ Đề/Theme Chính:**
{{themes}}

**Tần Suất Đăng Bài:**
{{frequency}}

**Sự Kiện/Ngày Đặc Biệt Tháng Này:**
{{events}}

Vui lòng cung cấp:
1. **Theme Nội Dung Hàng Tuần** (4 tuần)
2. **Ý Tưởng Nội Dung Hàng Ngày** với định dạng (bài đăng, story, video, v.v.)
3. **Phối Hợp Nội Dung**: Giáo dục, giải trí, quảng bá, tập trung tương tác
4. **Chiến Lược Hashtag**: Hashtag phù hợp cho mỗi theme
5. **Đề Xuất Lời Kêu Gọi Hành Động**: Cách thúc đẩy tương tác

{{toneHints}}`,
      },
      contentRepurposingStrategy: {
        userTemplate: `Tôi muốn tái sử dụng nội dung của mình: {{originalContent}}

**Định Dạng Gốc:**
{{originalFormat}}

**Nền Tảng Mục Tiêu:**
{{targetPlatforms}}

**Thông Điệp/Điểm Chính:**
{{keyMessages}}

Vui lòng đề xuất:
1. **Ý Tưởng Tái Sử Dụng**: 5-7 cách chuyển đổi nội dung này
2. **Điều Chỉnh Theo Nền Tảng**: Cách tối ưu cho từng kênh
3. **Phái Sinh Nội Dung**: Trích dẫn, đoạn ngắn, hình ảnh để trích xuất
4. **Dòng Thời Gian Phân Phối**: Khi nào và đăng ở đâu cho mỗi phần
5. **Hook Tương Tác**: Cách làm cho mỗi phiên bản hấp dẫn

{{toneHints}}`,
      },
      contentArticleWriter: {
        userTemplate: `Viết một bài viết {{wordCount}} từ về: {{topic}}

**Đối Tượng Mục Tiêu:**
{{audience}}

**Điểm Chính Cần Đề Cập:**
{{keyPoints}}

**Từ Khóa SEO Cần Bao Gồm:**
{{keywords}}

**Giọng Điệu Mong Muốn:**
{{tone}}

**Lời Kêu Gọi Hành Động:**
{{cta}}

Vui lòng cấu trúc bài viết với:
1. **Tiêu Đề Hấp Dẫn** (với 2-3 biến thể)
2. **Mở Đầu** (hook + tổng quan)
3. **Phần Nội Dung** (với tiêu đề phụ H2/H3)
4. **Kết Luận** (tóm tắt + CTA)
5. **Meta Description** (150-160 ký tự)

{{toneHints}}`,
      },
      socialPostGenerator: {
        userTemplate: `Tạo {{numberOfPosts}} bài đăng hấp dẫn cho {{platform}} về chủ đề: {{topic}}

Bối cảnh (sử dụng thông tin có sẵn, tự suy luận thông minh cho phần còn thiếu):
- Đối tượng mục tiêu: {{audience}}
- Mục tiêu bài đăng: {{goals}}
- Thông điệp chính: {{messages}}
- Hashtag: {{hashtags}}

Tạo nội dung sáng tạo, thu hút với:
1. **{{numberOfPosts}} Biến thể bài đăng** - Mỗi bài độc đáo và tối ưu cho nền tảng
2. **Câu mở đầu hấp dẫn** - Câu mở đầu thu hút sự chú ý ngay lập tức
3. **Gợi ý hình ảnh** - Ý tưởng hình ảnh/video cho từng bài đăng
4. **Chiến thuật tương tác** - Câu hỏi, bình chọn, hoặc lời kêu gọi hành động
5. **Thời gian đăng tối ưu** - Khung giờ đăng bài để đạt tương tác cao nhất

Quan trọng: Nếu bất kỳ thông tin nào ở trên bị thiếu hoặc tối thiểu, hãy tự suy luận các giá trị mặc định hợp lý dựa trên chủ đề và nền tảng. Hãy tự tin thực hiện mà không yêu cầu thêm thông tin.

{{toneHints}}`,
      },
      tourItineraryDesigner: {
        userTemplate: `Thiết kế lịch trình tour cho: {{destination}}

**Thời Lượng Tour:**
{{duration}}

**Đối Tượng Mục Tiêu:**
{{audience}}

**Theme/Trọng Tâm Tour:**
{{theme}}

**Điểm Tham Quan Bắt Buộc:**
{{attractions}}

**Mức Ngân Sách:**
{{budgetLevel}}

Vui lòng tạo:
1. **Lịch Trình Theo Ngày**: Lịch chi tiết với thời gian
2. **Điểm Dừng & Trải Nghiệm Chính**: Gì, đâu, tại sao cho mỗi địa điểm
3. **Logistics**: Đề xuất di chuyển, bữa ăn, chỗ ở
4. **Yếu Tố Kể Chuyện**: Bối cảnh lịch sử và câu chuyện hấp dẫn
5. **Tùy Chọn Linh Hoạt**: Hoạt động thay thế cho các sở thích khác nhau
6. **Mẹo Thực Tế**: Thời gian tốt nhất để tham quan, mang theo gì, lời khuyên nội bộ

{{toneHints}}`,
      },
      tourMarketingContent: {
        userTemplate: `Tạo nội dung marketing cho tour của tôi: {{tourName}}

**Điểm Đến:**
{{destination}}

**Điểm Nổi Bật Tour:**
{{highlights}}

**Thời Lượng & Giá:**
{{durationAndPrice}}

**Điểm Bán Hàng Độc Đáo:**
{{usp}}

**Đối Tượng Mục Tiêu:**
{{audience}}

Vui lòng tạo:
1. **Mô Tả Tour** (300-400 từ cho website)
2. **Giới Thiệu Ngắn** (50-75 từ cho quảng cáo)
3. **Bài Đăng Mạng Xã Hội** (3-5 biến thể cho Instagram/Facebook)
4. **Tiêu Đề Email** (5 tùy chọn)
5. **Điểm Nhắn Nhủ Chính**: Tại sao đặt tour này thay vì đối thủ
6. **Biến Thể Lời Kêu Gọi Hành Động**: CTA hấp dẫn để thúc đẩy đặt chỗ

{{toneHints}}`,
      },
    },

    // Approved panel
    approvedPanel: {
      title: 'Phiên bản đã duyệt',
      emptyMessage: 'Chưa có nội dung đã duyệt. Nhấn dấu tích ở bất kỳ phản hồi AI nào để đặt làm bản cuối.',
      useInEditor: 'Dùng trong trình soạn bài',
      copy: 'Sao chép',
      clear: 'Xoá',
      approvedAt: 'Đã duyệt lúc',
    },

    // Tone names
    tones: {
      conversational: {
        name: 'Thân mật',
        description: 'Gần gũi, trò chuyện tự nhiên, như nói chuyện với bạn',
      },
      professional: {
        name: 'Chuyên nghiệp',
        description: 'Trang trọng, chuẩn mực, rõ ràng và mạch lạc',
      },
      storytelling: {
        name: 'Kể chuyện',
        description: 'Kể chuyện theo dòng cảm xúc, có nhịp điệu, giàu hình ảnh',
      },
      academic: {
        name: 'Học thuật',
        description: 'Dựa trên nghiên cứu, phân tích, mang tính học thuật',
      },
      playful: {
        name: 'Vui tươi',
        description: 'Vui tươi, hài hước, linh hoạt',
      },
      inspirational: {
        name: 'Truyền cảm hứng',
        description: 'Truyền động lực, cảm hứng tích cực',
      },
      journalistic: {
        name: 'Báo chí',
        description: 'Khách quan, trung tính, mang phong cách báo chí',
      },
      minimal: {
        name: 'Tối giản & Sạch sẽ',
        description: 'Ngắn gọn, súc tích, tinh gọn và rõ ràng',
      },
    },

    // Use cases
    useCases: {
      content_ideas: {
        title: 'Ý tưởng nội dung',
        description: 'Gợi ý danh sách ý tưởng nội dung cho thương hiệu hoặc chủ đề.',
      },
      brand_tone_rewrite: {
        title: 'Viết lại theo tone thương hiệu',
        description: 'Dán đoạn văn bản và AI sẽ viết lại theo tone thương hiệu bạn chọn.',
      },
      social_caption_optimize: {
        title: 'Tối ưu caption mạng xã hội',
        description: 'Tối ưu caption cho Facebook / Instagram / TikTok với hook & CTA phù hợp.',
      },
      hashtag_strategy: {
        title: 'Chiến lược hashtag',
        description: 'Gợi ý hashtag phù hợp cho từng nền tảng mạng xã hội.',
      },
    },

    // Workflow steps
    workflow: {
      brief: {
        label: 'Định hướng',
        description: 'Cung cấp thông tin đầu vào, đối tượng mục tiêu, bối cảnh',
        placeholder: 'Hãy mô tả sản phẩm / nội dung / mục tiêu bạn muốn tạo…',
      },
      suggest: {
        label: 'Đề xuất',
        description: 'AI đề xuất góc nhìn, outline và hướng tiếp cận',
        placeholder: 'Hãy yêu cầu AI đề xuất outline / góc nhìn / ý tưởng tiếp cận…',
      },
      create: {
        label: 'Tạo nội dung',
        description: 'AI tạo bản nháp hoàn chỉnh dựa trên tone và use case',
        placeholder: 'Hãy yêu cầu AI tạo nội dung hoàn chỉnh dựa trên brief…',
      },
      optimize: {
        label: 'Tối ưu',
        description: 'AI tối ưu nội dung cho nền tảng, độ dài, CTA, format',
        placeholder: 'VD: Tối ưu bài viết này cho TikTok / Facebook với đúng độ dài…',
      },
      approve: {
        label: 'Phê duyệt',
        description: 'Xem lại lần cuối, format sạch, cho phép xuất/sao chép',
        placeholder: 'Yêu cầu AI tổng hợp phiên bản cuối cùng…',
      },
    },

    // Onboarding & In-Product Hints
    onboarding: {
      // Template Engine (Quick Picker / Script Selection)
      templateEngine: {
        tooltip: 'Kịch bản cung cấp hành vi AI chuyên biệt với quy tắc định dạng có sẵn',
        firstUseHint: 'Chọn kịch bản để mở khóa cấu trúc nội dung nâng cao',
        emptyStateTitle: 'Chưa chọn kịch bản',
        emptyStateMessage: 'Đang dùng engine AI mặc định. Chọn kịch bản ở trên để sử dụng định dạng chuyên biệt.',
        viewAllTooltip: 'Duyệt tất cả kịch bản có sẵn được sắp xếp theo danh mục',
      },

      // Workspace (Main Chat Area)
      workspace: {
        firstPromptPlaceholder: 'Mô tả nội dung bạn muốn tạo, hoặc yêu cầu AI đề xuất ý tưởng...',
        emptyConversationTitle: 'Bắt đầu tạo nội dung với AI',
        emptyConversationMessage: 'Chọn tone giọng và kịch bản ở trên, sau đó mô tả mục tiêu nội dung của bạn',
        toneSelectionHint: 'Chọn tone giọng để thiết lập phong cách viết cho tất cả phản hồi AI',
        scriptBadgeTooltip: 'Đang dùng kịch bản này. Nhấn để xem chi tiết hoặc thay đổi.',
      },

      // Prompt Kit Panel (Tactical Helper - Right Side)
      promptKit: {
        panelTitle: '🧩 Prompt Kit',
        panelDescription: 'Các prompt chiến thuật nhanh cho chỉnh sửa nội dung thông dụng',
        emptyState: 'Không có prompt kit khả dụng',
        categoryHint: 'Được tổ chức theo loại tác vụ để truy cập nhanh',
        usageHint: 'Nhấn vào bất kỳ prompt nào để áp dụng ngay vào cuộc hội thoại',
      },

      // Approved Panel
      approvedPanel: {
        firstUseHint: 'Nhấn ✓ ở bất kỳ phản hồi AI nào để phê duyệt nó làm phiên bản cuối',
        actionHintCopy: 'Sao chép nội dung đã duyệt vào clipboard',
        actionHintUseInEditor: 'Gửi nội dung này trực tiếp đến Trình soạn bài',
        actionHintClear: 'Xóa nội dung đã duyệt và bắt đầu lại',
      },

      // Tone Selector
      toneSelector: {
        tooltip: 'Thiết lập phong cách viết cho tất cả nội dung do AI tạo',
        firstUseHint: 'Chọn tone giọng phù hợp với giọng điệu thương hiệu của bạn',
      },

      // General First-Use
      firstSession: {
        welcomeTitle: 'Chào mừng đến AI Studio',
        welcomeMessage: '1. Chọn tone giọng · 2. Chọn kịch bản (tùy chọn) · 3. Mô tả mục tiêu nội dung',
        keyboardShortcutHint: 'Nhấn ⏎ để gửi, ⇧⏎ để xuống dòng',
      },
    },

    // Error States & Recovery Guidance
    errorStates: {
      // API & Network Errors
      api: {
        timeout: {
          title: 'Yêu cầu hết thời gian',
          message: 'AI mất quá nhiều thời gian để phản hồi. Điều này thường xảy ra với yêu cầu phức tạp.',
          action: 'Thử đơn giản hóa prompt hoặc thử lại',
        },
        networkError: {
          title: 'Vấn đề kết nối',
          message: 'Không thể kết nối đến dịch vụ AI. Kiểm tra kết nối internet của bạn.',
          action: 'Thử lại khi kết nối được khôi phục',
        },
        serverError: {
          title: 'Dịch vụ tạm thời không khả dụng',
          message: 'Dịch vụ AI gặp lỗi. Nội dung của bạn vẫn an toàn.',
          action: 'Đợi một chút và thử lại',
        },
        rateLimitExceeded: {
          title: 'Quá nhiều yêu cầu',
          message: 'Bạn đã đạt giới hạn yêu cầu. Hãy nghỉ ngắn.',
          action: 'Thử lại sau vài phút',
        },
      },

      // Content & Template Errors
      content: {
        noResults: {
          title: 'Không tạo được nội dung',
          message: 'AI không thể tạo nội dung cho yêu cầu này. Thử diễn đạt lại.',
          action: 'Điều chỉnh prompt và thử lại',
        },
        templateLoadFailed: {
          title: 'Kịch bản không khả dụng',
          message: 'Không thể tải kịch bản này. Bạn vẫn có thể dùng engine mặc định.',
          action: 'Chọn kịch bản khác hoặc tiếp tục với mặc định',
        },
        templateNotFound: {
          title: 'Không tìm thấy kịch bản',
          message: 'Kịch bản này không còn tồn tại hoặc đã được di chuyển.',
          action: 'Duyệt các kịch bản có sẵn',
        },
        approvalFailed: {
          title: 'Không thể phê duyệt nội dung',
          message: 'Có vấn đề khi lưu phiên bản đã duyệt của bạn.',
          action: 'Thử sao chép nội dung thủ công',
        },
      },

      // Input Validation Errors
      input: {
        tooLong: {
          message: 'Prompt quá dài ({current} ký tự). Tối đa là {max} ký tự.',
          action: 'Rút ngắn prompt và thử lại',
        },
        emptyPrompt: {
          message: 'Vui lòng nhập prompt để gửi đến AI',
        },
        invalidFormat: {
          message: 'Định dạng đầu vào này không được hỗ trợ',
          action: 'Kiểm tra đầu vào và thử lại',
        },
      },

      // Library & Storage Errors
      library: {
        saveFailed: {
          title: 'Không thể lưu vào thư viện',
          message: 'Có vấn đề khi lưu nội dung này.',
          action: 'Sao chép nội dung thủ công để dự phòng',
        },
        loadFailed: {
          title: 'Không thể tải thư viện',
          message: 'Không thể truy cập nội dung đã lưu ngay bây giờ.',
          action: 'Thử làm mới trang',
        },
        deleteFailed: {
          title: 'Không thể xóa mục',
          message: 'Có vấn đề khi xóa mục này khỏi thư viện.',
          action: 'Làm mới và thử lại',
        },
      },

      // General Fallback
      general: {
        unknownError: {
          title: 'Đã xảy ra lỗi',
          message: 'Lỗi không mong đợi đã xảy ra. Công việc của bạn vẫn an toàn.',
          action: 'Làm mới trang nếu vấn đề vẫn tiếp diễn',
        },
      },
    },

    // Template Browser
    templates: {
      title: 'Thư Viện Kịch Bản',
      subtitle: 'Chọn một kịch bản để bắt đầu với cấu trúc prompt có sẵn',
      searchPlaceholder: 'Tìm kiếm mẫu...',
      empty: {
        title: 'Không tìm thấy mẫu nào',
        description: 'Thử điều chỉnh tìm kiếm hoặc chọn danh mục khác',
      },
      complexity: {
        basic: 'Cơ bản',
        advanced: 'Nâng cao',
      },
      language: {
        both: 'VI + EN',
        vi: 'VI',
        en: 'EN',
      },
      actions: {
        use: 'Dùng mẫu',
        close: 'Đóng',
      },

      // Template Categories
      categories: {
        seo: {
          name: 'SEO & Từ Khóa',
          description: 'Tối ưu công cụ tìm kiếm và nghiên cứu từ khóa',
        },
        'content-strategy': {
          name: 'Chiến Lược Nội Dung',
          description: 'Lập kế hoạch chiến lược và kiến trúc nội dung',
        },
        'content-creation': {
          name: 'Tạo Nội Dung',
          description: 'Viết bài và tạo nội dung mạng xã hội',
        },
        tour: {
          name: 'Du Lịch & Tour',
          description: 'Lập kế hoạch tour, lịch trình và nội dung du lịch',
        },
      },

      // Individual Templates
      items: {
        'seo-competitor-analysis': {
          name: 'Phân Tích Đối Thủ SEO',
          description: 'Phân tích chiến lược nội dung đối thủ và xác định khoảng trống trong cách tiếp cận SEO của bạn',
        },
        'seo-keyword-opportunities': {
          name: 'Tìm Cơ Hội Từ Khóa',
          description: 'Khám phá cơ hội từ khóa tiềm năng dựa trên ngách và đối tượng của bạn',
        },
        'seo-strategic-content-ideas': {
          name: 'Ý Tưởng Nội Dung Chiến Lược (Tập Trung SEO)',
          description: 'Tạo ý tưởng nội dung tối ưu SEO phù hợp với nghiên cứu từ khóa',
        },
        'seo-content-refresh': {
          name: 'Làm Mới & Tối Ưu Nội Dung',
          description: 'Phân tích nội dung hiện có và đề xuất cải tiến để xếp hạng tốt hơn',
        },
        'content-pillar-cluster': {
          name: 'Chiến Lược Trụ Cột - Cụm',
          description: 'Thiết kế chiến lược cụm chủ đề với nội dung trụ cột và bài viết hỗ trợ',
        },
        'content-30day-plan': {
          name: 'Kế Hoạch Nội Dung 30 Ngày',
          description: 'Tạo lịch nội dung 30 ngày toàn diện với chiến lược đăng bài hàng ngày',
        },
        'content-repurposing-strategy': {
          name: 'Chiến Lược Tái Sử Dụng Nội Dung',
          description: 'Chuyển đổi nội dung hiện có thành nhiều định dạng cho các nền tảng khác nhau',
        },
        'content-article-writer': {
          name: 'Viết Bài Tùy Chỉnh',
          description: 'Tạo bài viết blog hoàn chỉnh hoặc nội dung dạng dài',
        },
        'content-social-post-generator': {
          name: 'Tạo Bài Đăng Mạng Xã Hội',
          description: 'Tạo bài đăng mạng xã hội tối ưu cho nền tảng với hook và CTA',
        },
        'tour-itinerary-designer': {
          name: 'Thiết Kế Lịch Trình Tour',
          description: 'Tạo lịch trình tour chi tiết với điểm dừng, thời gian và trải nghiệm',
        },
        'tour-marketing-content': {
          name: 'Gói Nội Dung Marketing Tour',
          description: 'Tạo nội dung quảng cáo cho gói tour (mô tả, quảng cáo, bài đăng mạng xã hội)',
        },
      },
    },
  },
} as const;

export type ViDictionary = typeof viDictionary;

/**
 * Helper type: Preserves key structure but allows any string values
 * Used for EN dictionary to match VI structure without literal value constraints
 */
export type DeepStringMap<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, any>
      ? DeepStringMap<T[K]>
      : T[K];
};

/**
 * Flexible prompts type: allows any prompt templates with userTemplate string
 * This is intentionally loose because EN/VI may have different prompt sets
 */
export type PromptsMap = Record<string, { userTemplate: string }>;

/**
 * Dictionary type with flexible prompts section
 * Allows EN/VI to have different prompt template sets while keeping
 * all other sections strictly typed
 */
type StrictViDict = DeepStringMap<typeof viDictionary>;
export type FlexibleDictionary = Omit<StrictViDict, 'studio'> & {
  studio: Omit<StrictViDict['studio'], 'prompts'> & {
    prompts: PromptsMap;
  };
};
