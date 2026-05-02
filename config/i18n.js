const {
  defaultLanguage,
  getLegacyProvinceNamesByCode,
  getProvinceCodeLabels: getProvinceCodeLabelsFromMetadata,
  supportedLanguages
} = require('./provinceMetadata');

const provinceCodeLabels = Object.fromEntries(
  supportedLanguages.map((language) => [language, getProvinceCodeLabelsFromMetadata(language)])
);

const legacyProvinceNamesByCode = getLegacyProvinceNamesByCode();

// 站内文案与省份元数据分开维护：
// 纯界面文本在 messages，行政区显示名仍复用 provinceMetadata 里的权威定义。
function buildLocalizedLegacyProvinceNames(language) {
  return Object.fromEntries(
    Object.entries(legacyProvinceNamesByCode).map(([code, legacyName]) => [legacyName, provinceCodeLabels[language][code]])
  );
}

const messages = {
  'zh-CN': {
    common: {
      siteName: 'NO CONVERSION THERAPY',
      language: '语言',
      switchLanguage: '切换',
      footerNavLabel: '页脚导航',
      languages: {
        'zh-CN': '简中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 N·C·T Project.',
      loading: '加载中...',
      notFound: '未找到'
    },
    pageTitles: {
      home: '首页|{title}',
      form: '填写表单|{title}',
      institutionCorrection: '机构信息补充 / 修正|{title}',
      institutionCorrectionSuccess: '补充 / 修正已提交|{title}',
      institutionCorrectionError: '补充 / 修正提交失败|{title}',
      map: '地图|{title}',
      mapRecord: '提交详情|{title}',
      about: '关于我们|{title}',
      privacy: '隐私政策与 Cookie 说明|{title}',
      submitPreview: '提交预览|{title}',
      submitConfirm: '提交确认|{title}',
      submitError: '提交失败|{title}',
      blog: '文库|{title}',
      article: '{articleTitle}|{title}',
      debug: '调试|{title}',
      maintenance: '站点维护|{title}'
    },
    navigation: {
      home: '返回首页',
      about: '关于我们',
      privacy: '隐私政策 / Cookie 说明',
      allArticles: '所有文章'
    },
    index: {
      tagline: '凡真心所向，皆成回响；足以在偏见的荒原，震碎扭曲的枷锁',
      fillForm: '填写表单',
      viewMap: '地图',
      blogLibrary: '文库'
    },
    blog: {
      title: 'NCT.Blogs',
      subtitle: '也许这里会有一些有用的内容',
      all: '全部',
      author: '作者：',
      creationDate: '创稿日期：',
      language: '语言：',
      noTag: '#无标签',
      empty: '暂时还没有文章喵~',
      articleNotFound: '文章不存在',
      articleLanguages: {
        zhCN: '简体中文',
        zhTW: '繁体中文',
        en: '英文'
      },
      tags: {
        '1': '更新',
        '2': '公告',
        '3': '回忆录',
        '4': '杂谈',
        '5': '法律',
        '6': '精选',
        '7': '讣告'
      }
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: '记录黑暗，是为了迎接光明',
      privacyNotice: '隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密，相关经历、机构曝光信息未来可能公开展示，请勿在可能公开的字段中填写身份证号、私人电话、家庭住址等您的个人敏感信息。',
      sections: {
        basic: '个人基本信息',
        experience: '相关经历',
        victimExperience: '受害人经历',
        exposure: '机构曝光信息'
      },
      fields: {
        identity: '请问您是作为什么身份来填写本表单？',
        agentRelationship: '您与受害者的关系？',
        birthDate: '出生年月日',
        birthYear: '出生年份',
        victimBirthYear: '受害者出生年份',
        birthMonth: '出生月份',
        birthDay: '出生日期',
        age: '年龄',
        sex: '性别',
        victimSex: '受害者性别',
        preInstitutionProvinceCode: '进入机构前所在省份？',
        preInstitutionCityCode: '进入机构前所在城市？',
        province: '机构所在省份',
        city: '机构所在城市 / 区县',
        county: '机构所在县区',
        schoolName: '机构名称',
        schoolAddress: '机构地址',
        dateStart: '首次被送入日期',
        dateEnd: '离开日期',
        parentMotivations: '家长选择矫正机构的原因/动机？',
        exitMethod: '离开机构的方式',
        experience: '个人在校经历描述',
        legalAidStatus: '是否曾对此经历进行过举报或寻求法律援助',
        headmasterName: '负责人/校长姓名',
        abuserInfo: '已知施暴者/教官基本信息与描述',
        contactInformation: '机构联系方式',
        violenceCategories: '机构丑闻及暴力行为（请选出符合自己经历及目睹他人受暴的所有选项）',
        scandal: '丑闻及暴力行为详细描述',
        other: '其它补充'
      },
      identityOptions: {
        self: '受害者本人',
        agent: '受害者的代理人'
      },
      agentRelationshipOptions: {
        friend: '朋友',
        partner: '伴侣',
        family: '亲属',
        supportWorker: '救助工作者',
        other: '其它'
      },
      sexOptions: {
        placeholder: '请选择',
        male: '男性',
        female: '女性',
        other: '其它性别认同'
      },
      sexIdentityOptions: {
        mtf: 'MtF',
        ftm: 'FtM',
        x: 'X',
        queer: 'Queer'
      },
      parentMotivationOptions: {
        internetAddiction: '"网瘾"/游戏沉迷',
        studyIssues: '"厌学"/学业问题',
        behaviorControl: '"叛逆"/行为管教',
        mentalHealth: '精神或心理健康相关问题',
        genderIdentity: '性别认同相关（如跨性别等）',
        sexualOrientation: '性取向相关（如同性恋、双性恋等）',
        familyViolence: '家庭冲突中的恶意施暴或惩罚手段',
        professionalAdvice: '咨询师/医生/老师等人士建议',
        relativesAdvice: '亲属或身边人建议',
        advertising: '网络广告或机构宣传误导',
        unknown: '不清楚/从未被告知原因',
        other: '其它原因'
      },
      violenceCategoryOptions: {
        falsePromotion: '虚假/非法宣传',
        fakePolice: '冒充警察绑架',
        directPhysical: '直接接触的肢体暴力（如扇耳光等）',
        toolPhysical: '使用工具的肢体暴力（如棍棒殴打、电击等）',
        corporalPunishment: '体罚（如长跑等）',
        restriction: '限制自由（如捆绑等）',
        humiliation: '辱骂或公开羞辱',
        verbalSexual: '言语的性暴力（如性羞辱等）',
        physicalSexual: '肢体的性暴力（如性侵犯等）',
        solitary: '关禁闭',
        foodRestriction: '饮食限制或不健康饮食',
        sleepDeprivation: '睡眠剥夺',
        forcedMedication: '强迫服用药物',
        genderConversion: '性别扭转（如强迫改变外表等）',
        brainwashing: '精神控制或洗脑',
        other: '其它暴力行为'
      },
      exitMethodOptions: {
        pickedUp: '到期后家长接回',
        escape: '自行逃离',
        transfer: '被强制转学',
        rescued: '被解救',
        closed: '机构关闭',
        other: '其它方式'
      },
      legalAidOptions: {
        yes: '是',
        no: '否',
        unsureHow: '想但不知道途径',
        fearRetaliation: '担心报复',
        other: '其它'
      },
      placeholders: {
        agentRelationship: '请选择您与受害者的关系',
        agentRelationshipOther: '其它：请填写您与受害者的关系',
        birthYear: '选择年份',
        birthMonth: '选择月份',
        birthDay: '选择日期',
        age: '请输入年龄',
        otherSexType: '请选择',
        otherSex: '其它性别认同或补充说明',
        preInstitutionProvinceCode: '可选：选择进入机构前所在省份',
        preInstitutionCityCode: '可选：请先选择进入机构前所在省份',
        province: '选择机构所在省份',
        city: '请先选择机构所在省份',
        countyInitial: '可选：请先选择机构所在城市 / 区县',
        county: '可选：选择机构所在县区',
        countyUnavailable: '可选：当前机构所在城市无县区可选',
        schoolName: '请填写机构完整名称',
        schoolAddress: '若已知，请详细填写机构地址',
        parentMotivationOther: '其它原因：请填写具体原因',
        exitMethod: '可选：请选择离开机构的方式',
        exitMethodOther: '其它方式：请填写具体情况',
        experience: '请描述个人在校经历、管理方式等...',
        legalAidStatus: '可选：请选择当前情况',
        legalAidOther: '其它：请填写补充说明',
        headmasterName: '姓名',
        abuserInfo: '可填写施暴者姓名、联系方式、施暴内容等信息。',
        contactInformation: '电话、邮箱或其它公开联系方式',
        violenceCategoryOther: '其它暴力行为：请填写具体情况',
        scandal: '请描述已知的丑闻与暴力行为...',
        other: '任何您想补充的信息'
      },
      buttons: {
        openMap: '点击可直接在地图上选点',
        getCurrentLocation: '获取当前位置',
        submit: '确认并提交信息',
        locating: '定位中...',
        submitting: '提交中...'
      },
      hints: {
        dateStart: '假如有多次被送入经历，可在经历描述中说明情况',
        dateEnd: '若目前仍在校，可不填',
        experience: '若描述别人经历请在“其它补充”中填写',
        otherSex: '请选择 MtF / FtM / X / Queer，或点击输入框填写其它性别认同或补充说明',
        selectedPoint: '选取点: {lat}, {lng}'
      },
      location: {
        filled: '已获取当前位置: {lat}, {lng}',
        unsupported: '当前环境不支持定位，请使用 HTTPS 打开网页，或手动填写经纬度 / 在地图上选点。',
        permissionDenied: '定位权限已被拒绝，请允许访问位置信息后重试。',
        positionUnavailable: '暂时无法获取当前位置，请稍后重试。',
        timeout: '获取当前位置超时，请稍后重试。',
        failed: '获取当前位置失败，请稍后重试。'
      },
      validation: {
        selectIdentity: '请选择填写身份',
        fillBirthDate: '请选择出生年份',
        fillVictimBirthYear: '请选择受害者出生年份',
        invalidBirthDate: '请填写有效的{label}',
        fillAge: '请填写年龄',
        ageRange: '年龄必须是 {min} 到 {max} 的整数',
        selectSex: '请选择性别',
        selectVictimSex: '请选择受害者性别',
        selectProvince: '请选择机构所在省份',
        selectCity: '请选择机构所在城市 / 区县',
        fillSchoolName: '请填写机构名称',
        fillDateStart: '请填写首次被送入日期',
        fillContactInformation: '请填写机构联系方式',
        specifyOtherSex: '请选择 MtF / FtM / X / Queer，或选择输入框填写其它性别认同或补充说明',
        fillOtherSex: '请输入其它性别认同或补充说明',
        fillAgentRelationshipOther: '请输入您与受害者的关系',
        fillParentMotivations: '请至少选择一项家长选择矫正机构的原因/动机',
        fillParentMotivationOther: '请输入其它原因',
        fillViolenceCategoryOther: '请输入其它暴力行为',
        fillExitMethodOther: '请输入其它离开机构的方式',
        fillLegalAidOther: '请输入其它补充说明',
        endDateBeforeStart: '离开日期不能早于首次被送入日期'
      },
      standalone: {
        title: '扭转机构受害者情况问卷调查',
        footerMeta: '全国统一心理援助：12356；青少年心理咨询和法律援助：12355；希望热线（全国性24小时心理危机干预）：400-161-9995',
        honeypotLabel: '网站',
        safetyNotice: '填写过程中如感不适可随时停止'
      }
    },
    institutionCorrection: {
      title: '机构信息补充 / 修正',
      subtitle: '如果地图中的机构信息需要补充、修正或更新，可以在这里提交。',
      privacyNotice: '隐私说明：此表单提交内容会根据站点配置写入 Google Form、D1 数据库，或同时写入两者进行保存和整理。请尽量只填写机构公开信息，不要提交与此无关的个人敏感信息。',
      backToMap: '返回地图',
      sections: {
        institution: '机构信息',
        correction: '补充 / 修正说明'
      },
      fields: {
        schoolName: '机构名称',
        province: '机构所在省份',
        city: '机构所在城市 / 区县',
        county: '机构所在县区',
        schoolAddress: '机构地址',
        contactInformation: '机构联系方式',
        headmasterName: '负责人/校长姓名',
        correctionContent: '补充修正内容'
      },
      placeholders: {
        province: '可选：选择机构所在省份',
        city: '可选：请先选择机构所在省份',
        countyInitial: '可选：请先选择机构所在城市 / 区县',
        county: '可选：选择机构所在县区',
        countyUnavailable: '可选：当前机构所在城市无县区可选',
        schoolName: '请填写需要补充或修正的机构名称',
        schoolAddress: '可选：填写最新地址，或直接在地图上选点 / 获取当前位置',
        contactInformation: '可选：电话、邮箱或其它公开联系方式',
        headmasterName: '可选：负责人 / 校长姓名',
        correctionContent: '请说明需要补充或修正的内容'
      },
      buttons: {
        openMap: '点击可直接在地图上选点',
        getCurrentLocation: '获取当前位置',
        submit: '提交补充/修正',
        locating: '定位中...',
        submitting: '提交中...'
      },
      hints: {
        selectedPoint: '选取点: {lat}, {lng}',
        correctionContent: '例如：地址搬迁、联系方式变更、负责人信息补充、地图坐标修正等。'
      },
      location: {
        filled: '已获取当前位置: {lat}, {lng}',
        unsupported: '当前环境不支持定位，请使用 HTTPS 打开网页，或手动填写经纬度 / 在地图上选点。',
        permissionDenied: '定位权限已被拒绝，请允许访问位置信息后重试。',
        positionUnavailable: '暂时无法获取当前位置，请稍后重试。',
        timeout: '获取当前位置超时，请稍后重试。',
        failed: '获取当前位置失败，请稍后重试。'
      },
      validation: {
        fillSchoolName: '请填写机构名称',
        invalidProvince: '请选择有效的机构所在省份',
        provinceCityMismatch: '所选机构所在省份与城市 / 区县不匹配',
        cityCountyMismatch: '所选机构所在城市 / 区县与县区不匹配'
      },
      success: {
        title: '补充 / 修正请求已收到',
        message: '感谢你的补充。我们会在核实后处理这条机构信息修正请求。',
        backToMap: '返回地图'
      },
      errorPage: {
        title: '补充 / 修正提交失败',
        intro: '站内提交没有成功。如果下方提供了已预填内容的 Google Form 链接，你也可以继续在那里提交。',
        privacyNote: '注意：下面这个链接包含你刚刚填写的补充 / 修正内容，请不要随意分享。',
        proxyNote: '提示：如果你当前网络无法直接访问 Google 服务，打开 Google Form 页面可能需要网络代理。',
        openFallback: '打开 Google Form 继续提交',
        urlLabel: '带预填内容的 Google Form 链接',
        backToForm: '返回补充 / 修正表单'
      },
      errors: {
        submitFailedPrefix: '提交失败：',
        storageUnavailable: '机构信息补充 / 修正功能暂时不可用，请稍后再试。',
        submitFailed: '提交失败，请稍后再试。'
      }
    },
    map: {
      title: '机构地图',
      sections: {
        stats: '统计数据',
        tags: '标签',
        map: '地图',
        allData: '所有数据'
      },
      note: '注：本地图或许会有些许偏差',
      stats: {
        lastSynced: '数据最后一次更新：',
        updateNotice: '数据每 {seconds} 秒（{minutes} 分钟）更新一次，如未看到您的提交，请耐心等待',
        submittedForms: '已提交表单：',
        provinceStats: '各省已知机构数量：',
        provinceSubmissions: '各省投稿量',
        averageAge: '受害者平均年龄：',
        secondsAgo: '{seconds} 秒前',
        refresh: '刷新',
        ageValue: '{age} 岁',
        schoolNum: '已统计学校数量'
      },
      tags: {
        title: '填写类型',
        all: '全部',
        self: '受害者本人',
        agent: '受害者的代理人',
        bulk: '批量数据'
      },
      list: {
        searchPlaceholder: '检索学校名、负责人、省份、地址、丑闻、联系方式等',
        searchButton: '检索',
        noResults: '没有符合检索条件的结果',
        loadFailed: '数据加载失败',
        translationLoading: '翻译中...',
        translationUnavailable: '翻译失败',
        dateUnknown: '日期未标注',
        reportCounts: {
          self: '本人举报',
          agent: '代理举报'
        },
        pagination: {
          previous: '上一页',
          next: '下一页',
          page: '第 {current} / {total} 页',
          form: '第 {current} / {total} 份表单'
        },
        formDetail: {
          button: '查看详情页',
          title: '表单详细信息',
          close: '关闭'
        },
        fields: {
          scandal: '学校丑闻：',
          experience: '受害者经历：',
          other: '其它：',
          headmaster: '负责人：',
          province: '省份：',
          region: '城市 / 区县：',
          address: '地址：',
          contact: '联系方式：'
        },
        viewDetails: '查看详情页'
      },
      record: {
        backToMap: '返回地图列表',
        eyebrow: '提交详情',
        loading: '正在加载提交详情...',
        notFoundTitle: '未找到这份提交',
        notFoundBody: '这份提交可能已被合并、删除或暂时不可用。你可以返回地图列表继续查看。',
        loadFailedTitle: '提交详情加载失败',
        loadFailedBody: '暂时无法加载这份提交，请稍后重试。',
        documentTitle: '{school} | {site}'
      },
      api: {
        summary: '想要调用 API？',
        privacy: '我们明确表示：我们永远不会泄露受访者的任何敏感性资料。',
        beforeUse: '在调用 API 之前，请注意：公开接口仅提供当前在地图页面上展示的资料。',
        implementationTitle: '我们如何实现的？',
        implementationBody: '首先你的表单会透过 Vercel 上传到 Google Forms，在那里生成一个电子表格。站长在其表格的 Apps Script 中部署了应用程序，会将地址一栏转化为经纬度并保存在表格中。然后 Google 侧会生成一个原始 JSON API。因为那个 API 包含全部资讯，所以不会公开。本站再从中取出需要的讯息，生成当前对外开放的 API。',
        opinionTitle: '我们的看法：',
        opinionBody: '我们很希望你们使用这个 API 并接入到你们的网站上。即使网站被封禁，资料仍然可以透过 API 在不同网络中继续传播。这也是一种去中心化。',
        cta: '知道了这些，你就可以使用我们的 API 了。欢迎把它接入到你们的网站。',
        link: '获取 API 数据源',
        correctionHint: '如果你发现地图中的机构资料需要补充或修正，也可以通过下面的表单告诉我们。',
        correctionButton: '机构信息补充/修正'
      }
    },
    about: {
      title: '关于我们',
      friendLinks: '致谢',
      ownership: '本项目由 TRANS UNION 维护、开发，透过Apachi-2.0 License开源。',
      origin: '本网站建站于 2026 年 2 月 21 日，最初由幸存者社群协作建立。',
      thanks: '在这里衷心感谢以下项目、企业和个人为本项目提供了免费的援助，没有他们就没有这个网站的诞生：',
      friendDescriptions: {
        nanmuxue: '代码重构',
        hermaphroditus: '域名贡献者',
        muyuan: '社群传播、资料提供',
        amber: '社群建立'
      }
    },
    privacy: {
      title: '隐私政策与 Cookie 说明',
      intro: '本页面说明本站在页面访问、表单提交与公开展示过程中会如何处理相关信息。',
      meta: {
        effectiveDateLabel: '生效日期',
        effectiveDateValue: '2026年4月9日',
        updatedLabel: '最近更新',
        updatedValue: '2026年4月12日',
        scopeLabel: '适用范围',
        scopeValue: '本站页面、表单提交流程与相关公开展示内容'
      },
      tocLabel: '隐私说明目录',
      highlights: {
        submissionTitle: '表单提交',
        submissionBody: '表单内容由本站接收后，交由 Google Form / Google 表格保存与整理。',
        publicTitle: '公开展示',
        publicBody: '与机构曝光相关的内容可能整理后在本站公开页面展示。',
        cookieTitle: '站内 Cookie',
        cookieBody: '当前仅使用一个语言偏好 Cookie，不用于广告、跨站跟踪或画像分析。'
      },
      sections: {
        summary: '概览',
        formSubmission: '表单填写与公开展示',
        thirdParty: '第三方服务',
        retention: '保存期限与删除',
        security: '安全措施',
        cookie: '当前使用的 Cookie',
        manage: '您的选择',
        EULA: '适用法律与用户协议',
        contact: '联系我们',
        publicInfo: '公开数据'
      },
      summary: '本站当前仅在您主动切换语言时，使用一个站内 Cookie 来记住您的语言偏好。我们不会将该 Cookie 用于广告投放、跨站跟踪或画像分析。',
      overviewItems: [
        '当您浏览本站时，我们目前只会在您主动切换语言时写入一个语言偏好 Cookie。',
        '当您填写表单时，出生年份、性别等个人基本信息主要用于内部整理、核验与统计，不在本站公开页面直接展示。',
        '与机构曝光相关的内容在整理后，可能出现在本站公开页面、地图或相关展示模块中。'
      ],
      formLead: '表单提交通常会同时涉及内部处理信息和可能公开展示的信息。',
      formItems: [
        '内部处理信息通常包括出生年份、性别等个人基本信息，用于内部整理、核验与统计。',
        '可能公开展示的信息通常包括相关经历、机构名称、所在地区、机构地址、机构联系方式、负责人/校长姓名、丑闻及暴力行为描述和其他补充内容。',
        '如果您点击“获取当前位置”等定位按钮，浏览器会请求定位权限；定位结果仅用于帮您填充当前地址或经纬度，只有在您确认并提交表单后才会随表单一并发送。',
        '请不要在可能公开的字段中填写身份证号、私人电话、家庭住址、即时通讯账号或其他不适合公开的个人敏感信息。'
      ],
      cookieIntro: '当前网站使用的 Cookie 如下：',
      cookieFields: {
        name: '名称',
        purpose: '用途',
        trigger: '写入时机',
        retention: '保存期限',
        scope: '作用范围',
        attributes: '附加属性'
      },
      cookieValues: {
        purpose: '记住您选择的界面语言，避免下次访问时重复切换。',
        trigger: '当您通过页面语言切换器访问带有 ?lang=... 的地址，且新语言与现有设置不同时写入。',
        retention: '最长 30 天（Max-Age=2592000）。',
        scope: '本站根路径 / 下的页面。',
        attributes: 'SameSite=Lax。'
      },
      thirdPartyLead: '为完成表单保存与部分功能展示，本站可能使用以下第三方服务：',
      thirdPartyItems: [
        'Google Form / Google 表格：用于保存和整理表单提交内容。',
        'Google Cloud Translation（启用时）：当站内翻译功能开启时，部分公开展示文本可能发送至翻译服务处理。',
        '地图底图与静态资源 CDN：地图页面可能向相应服务加载公开底图或前端依赖资源。'
      ],
      retentionItems: [
        '语言偏好 Cookie 最长保存 30 天，或直到您主动删除。',
        '表单提交内容会按照项目运营、核验、统计、公开展示与后续整理需要保留；如需沟通更正或删除，请通过本页联系方式联系维护者。',
        '服务器侧运行日志与限流记录仅保留排查与安全防护所需的最小元信息，不会主动在审计日志中记录整份表单正文。'
      ],
      securityItems: [
        '本站对表单提交流程使用服务端校验、限流、防刷 token、蜜罐字段和敏感页面禁缓存等措施。',
        '我们会尽量减少在日志与公开接口中暴露不必要的信息，并对公开展示数据进行字段级筛选。',
        '但任何联网传输或第三方服务都无法承诺绝对安全；请在提交时自行避免填写不必要的个人敏感信息。'
      ],
      manageItems: [
        '您可以选择不提交表单，或仅填写您愿意提供的必要信息。',
        '您可以随时通过浏览器设置删除或拦截语言偏好 Cookie；删除后，网站会恢复为默认语言。',
        '如果您希望沟通更正、删除或下架与您相关的内容，请通过下方邮箱联系项目维护者。'
      ],
      contactBody: '如果您对本站隐私说明、表单公开范围或内容处理方式有疑问，可以通过以下方式联系项目维护者：'
    },
    submitSuccess: {
      badge: '成功',
      title: '提交成功！感谢你的参与。',
      message: '我们已经收到了你的表单，感谢你的参与。你的参与将是我们前进的动力！',
      backForm: '返回问卷',
      backHome: '返回首页',
      petition: '抵制扭转机构签名会'
    },
    submitStatus: {
      title: '调试提交结果',
      mode: '提交模式：',
      successfulTargets: '成功目标：',
      failedTargets: '失败目标：',
      error: '错误：',
      none: '无',
      targets: {
        both: 'Google Form + D1',
        d1: 'D1 数据库',
        google: 'Google Form'
      }
    },
    submitPreview: {
      badge: '预览',
      title: '表单 Dry Run 预览',
      intro: '这次提交还没有发送到实际提交目标。下面是本次本地组装出的最终字段和值。',
      targetUrl: 'Google Form 目标网址（若已启用）：',
      columns: {
        entry: 'Google Form Entry',
        field: '字段',
        value: '值'
      },
      payloadEyebrow: '提交负载',
      payload: 'URL Encoded Payload',
      backForm: '返回表单'
    },
    submitConfirm: {
      badge: '确认',
      title: '提交确认',
      intro: '这一步还没有发送到实际提交目标。请确认以下内容无误后，再正式提交。',
      targetUrl: '目标网址：',
      columns: {
        entry: 'Google Form Entry',
        field: '字段',
        value: '值'
      },
      confirm: '确认并提交',
      confirming: '提交中...',
      backForm: '返回表单'
    },
    submitError: {
      badge: '重试',
      title: '提交失败',
      intro: '站内提交没有成功。如果下方提供了已预填内容的 Google Form 链接，你也可以继续在那里提交。',
      privacyNote: '注意：下面这个链接包含你刚刚填写的表单内容，请不要随意分享。',
      proxyNote: '提示：如果你当前网络无法直接访问 Google 服务，打开 Google Form 页面可能需要网络代理。',
      openFallback: '打开 Google Form 继续提交',
      urlLabel: '带预填内容的 Google Form 链接',
      backForm: '返回表单'
    },
    maintenance: {
      badge: '站点维护中',
      title: '网站正在维护中',
      description: '为了带来更稳定的体验，站点正在升级与校验。页面、表单与 API 暂时不可用。',
      siteLabel: '站点',
      modeLabel: '服务状态',
      defaultNotice: '维护模式已开启',
      refresh: '重新尝试'
    },
    fields: {
      birthDate: '出生年月日',
      birthYear: '出生年份',
      victimBirthYear: '受害者出生年份',
      birthMonth: '出生月份',
      birthDay: '出生日期',
      age: '年龄',
      identity: '填写身份',
      agentRelationship: '您与受害者的关系？',
      sex: '性别',
      victimSex: '受害者性别',
      sexOther: '其它性别认同或补充说明',
      preInstitutionProvinceCode: '进入机构前所在省份？',
      preInstitutionCityCode: '进入机构前所在城市？',
      provinceCode: '机构所在省份',
      cityCode: '机构所在城市 / 区县',
      countyCode: '机构所在县区',
      parentMotivations: '家长选择矫正机构的原因/动机？',
      parentMotivationOther: '家长选择矫正机构的原因/动机（其它原因）',
      schoolName: '机构名称',
      schoolAddress: '机构地址',
      dateStart: '首次被送入日期',
      dateEnd: '离开日期',
      exitMethod: '离开机构的方式',
      exitMethodOther: '离开机构的方式（其它方式）',
      experience: '个人在校经历描述',
      headmasterName: '负责人/校长姓名',
      abuserInfo: '已知施暴者/教官基本信息与描述',
      contactInformation: '机构联系方式',
      violenceCategories: '机构丑闻及暴力行为',
      violenceCategoryOther: '机构丑闻及暴力行为（其它暴力行为）',
      scandal: '丑闻及暴力行为详细描述',
      legalAidStatus: '举报或寻求法律援助情况',
      legalAidOther: '举报或寻求法律援助情况（其它）',
      other: '其它补充'
    },
    previewFields: {
      birthDate: '出生年月日',
      province: '机构所在省份',
      city: '机构所在城市 / 区县',
      schoolName: '机构名称',
      identity: '填写身份',
      sex: '性别',
      schoolAddress: '机构地址',
      experience: '个人在校经历描述',
      headmasterName: '负责人/校长姓名',
      contactInformation: '机构联系方式',
      scandal: '丑闻及暴力行为详细描述',
      other: '其它补充',
      dateStart: '首次被送入日期',
      dateEnd: '离开日期'
    },
    formErrors: {
      required: '{label}为必填',
      maxLength: '{label}不能超过 {maxLength} 字',
      invalidBirthDate: '请填写有效的{label}',
      ageRange: '{label}必须是 {min} 到 {max} 的整数',
      invalidIdentity: '请选择有效的填写身份',
      invalidChoice: '{label}选项无效',
      invalidSex: '性别不合法，请修改',
      otherSexRequired: '选择其它性别认同时，请选择 MtF / FtM / X / Queer，或选择输入框填写其它性别认同或补充说明',
      provinceCityMismatch: '机构所在省份和机构所在城市 / 区县不匹配',
      preInstitutionProvinceCityMismatch: '进入机构前所在省份和进入机构前所在城市不匹配',
      cityCountyMismatch: '机构所在城市 / 区县和机构所在县区不匹配',
      invalidFormat: '{label}格式不正确',
      endDateBeforeStart: '{endLabel}不能早于{startLabel}'
    },
    server: {
      submitFailedPrefix: '提交失败：',
      submitFailed: '提交失败',
      invalidFormSubmission: '提交已失效或异常，请刷新页面后重试。',
      maintenanceActive: '站点正在维护中，请稍后再试。',
      tooManyRequests: '请求过于频繁，请稍后再试。',
      mapDataUnavailable: '无法取得地图数据',
      areaOptionsUnavailable: '无法取得地区选项'
    },
    debug: {
      title: '调试',
      intro: '此页面仅在 DEBUG_MOD=true 时可用。',
      sections: {
        request: '请求与运行时',
        site: '站点配置',
        integrations: '集成状态',
        limits: '限流与表单参数',
        tools: '调试工具'
      },
      labels: {
        language: '语言',
        requestPath: '当前路径',
        runtime: '运行时',
        assetVersion: '资源版本',
        siteTitle: '站点标题',
        siteUrl: '站点地址',
        apiUrl: 'API 地址',
        debugMode: '调试模式',
        formDryRun: '表单干跑',
        formSubmitTarget: '表单提交目标',
        correctionSubmitTarget: '补充 / 修正提交目标',
        maintenanceMode: '维护模式',
        maintenanceRetryAfter: '维护重试时间',
        trustProxy: 'Trust Proxy',
        mapNodeTransport: 'Node 地图传输覆写',
        googleForm: 'Google Form 提交地址',
        correctionGoogleForm: '补充 / 修正 Google Form',
        googleScript: '私有地图上游',
        publicMapDataUrl: '公开地图回退源',
        translationProvider: '翻译服务',
        redisRateLimit: 'Redis 限流存储',
        formProtectionSecret: '表单保护 Secret',
        pageReadLimit: '页面读取限流',
        mapReadLimit: '地图读取限流',
        submitRateLimit: '提交限流',
        mapUpstreamTimeout: '地图上游超时',
        translationTimeout: '翻译服务超时',
        minFillMs: '最短填写时长',
        maxAgeMs: '表单 Token 有效期'
      },
      values: {
        enabled: '已启用',
        disabled: '未启用',
        configured: '已配置',
        missing: '未配置',
        unknown: '未知',
        explicit: '显式配置',
        derived: '派生值',
        memoryOnly: '仅内存模式',
        publicFallbackOnly: '仅公开回退',
        node: 'Node.js',
        workers: 'Cloudflare Workers',
        limitWindow: '每 {minutes} 分钟 {count} 次',
        milliseconds: '{count} ms',
        seconds: '{count} s'
      },
      samples: {
        d1SkippedError: '调试模拟跳过了真实的 D1 写入。',
        form: {
          schoolName: '调试预览学院',
          schoolAddress: '洛江区调试路 12 号',
          experience: '用于检查布局与多语言展示的调试预览内容。',
          headmasterName: '调试负责人',
          contactInformation: 'debug-preview@example.com',
          scandal: '仅用于调试的丑闻摘要占位内容。',
          other: '仅用于调试的其他补充内容。'
        },
        correction: {
          schoolName: '调试修正学院',
          schoolAddress: '洛江区修正调试路 5 号',
          contactInformation: 'debug-correction@example.com',
          headmasterName: '调试修正负责人',
          correctionContent: '用于检查 Google Form 回退链接和结果页布局的调试修正内容。'
        }
      },
      submitTargets: {
        both: 'Google Form + D1',
        d1: 'D1 数据库',
        google: 'Google Form'
      },
      links: {
        submitErrorPreview: '查看提交失败页预览',
        submitPreview: '查看提交预览页',
        submitConfirm: '查看提交确认页',
        correctionSubmitSuccessPreview: '查看补充 / 修正成功页预览',
        correctionSubmitErrorPreview: '查看补充 / 修正失败页预览'
      }
    },
    data: {
      inputTypes: {
        self: '受害者本人',
        agent: '受害者的代理人',
        bulk: '批量数据'
      },
      provinceNames: buildLocalizedLegacyProvinceNames('zh-CN')
    }
  },
  'zh-TW': {
    common: {
      siteName: 'NO CONVERSION THERAPY',
      language: '語言',
      switchLanguage: '切換',
      footerNavLabel: '頁腳導航',
      languages: {
        'zh-CN': '簡中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 N·C·T Project.',
      loading: '載入中...',
      notFound: '未找到'
    },
    pageTitles: {
      home: '主頁|{title}',
      form: '填寫表單|{title}',
      institutionCorrection: '機構資訊補充 / 修正|{title}',
      institutionCorrectionSuccess: '補充 / 修正已提交|{title}',
      institutionCorrectionError: '補充 / 修正提交失敗|{title}',
      map: '地圖|{title}',
      mapRecord: '提交詳情|{title}',
      about: '關於我們|{title}',
      privacy: '隱私政策與 Cookie 說明|{title}',
      submitPreview: '提交預覽|{title}',
      submitConfirm: '提交確認|{title}',
      submitError: '提交失敗|{title}',
      blog: '文庫|{title}',
      article: '{articleTitle}|{title}',
      debug: '調試|{title}',
      maintenance: '站點維護|{title}'
    },
    navigation: {
      home: '返回首頁',
      about: '關於我們',
      privacy: '隱私政策 / Cookie 說明',
      allArticles: '所有文章'
    },
    index: {
      tagline: '凡真心所向，皆成迴響；足以在偏見的荒原，震碎扭曲的枷鎖',
      fillForm: '填寫表單',
      viewMap: '地圖',
      blogLibrary: '文庫'
    },
    blog: {
      title: 'NCT.Blogs',
      subtitle: '在這裡，也許會有些有用的',
      all: '全部',
      author: '作者：',
      creationDate: '創稿日期：',
      language: '語言：',
      noTag: '#無標籤',
      empty: '暫時還沒有文章喵~',
      articleNotFound: '文章不存在',
      articleLanguages: {
        zhCN: '簡體中文',
        zhTW: '繁體中文',
        en: '英文'
      },
      tags: {
        '1': '更新',
        '2': '公告',
        '3': '回憶錄',
        '4': '雜談',
        '5': '法律',
        '6': '精選',
        '7': '訃告'
      }
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: '記錄黑暗，是為了迎接光明',
      privacyNotice: '隱私說明：本問卷中填寫的出生年份、性別等個人基本資訊將被嚴格保密，相關經歷、機構曝光資訊未來可能公開展示；請勿在可能公開的欄位中填寫身分證號、私人電話、家庭住址等您的個人敏感資訊。',
      sections: {
        basic: '個人基本資訊',
        experience: '相關經歷',
        victimExperience: '受害人經歷',
        exposure: '機構曝光資訊'
      },
      fields: {
        identity: '請問您是作爲什麽身份來填寫本表單？',
        agentRelationship: '您與受害者的關係？',
        birthDate: '出生年月日',
        birthYear: '出生年份',
        victimBirthYear: '受害者出生年份',
        birthMonth: '出生月份',
        birthDay: '出生日期',
        age: '年齡',
        sex: '性別',
        victimSex: '受害者性別',
        preInstitutionProvinceCode: '進入機構前所在省份？',
        preInstitutionCityCode: '進入機構前所在城市？',
        province: '機構所在省份',
        city: '機構所在城市 / 區縣',
        county: '機構所在縣區',
        schoolName: '機構名稱',
        schoolAddress: '機構地址',
        dateStart: '首次被送入日期',
        dateEnd: '離開日期',
        parentMotivations: '家長選擇矯正機構的原因 / 動機？',
        exitMethod: '離開機構的方式',
        experience: '個人在校經歷描述',
        legalAidStatus: '是否曾對此經歷進行過舉報或尋求法律援助',
        headmasterName: '負責人/校長姓名',
        abuserInfo: '已知施暴者 / 教官基本資訊與描述',
        contactInformation: '機構聯繫方式',
        violenceCategories: '機構醜聞及暴力行為（請選出符合自己經歷及目睹他人受暴的所有選項）',
        scandal: '醜聞及暴力行為詳細描述',
        other: '其他補充'
      },
      identityOptions: {
        self: '受害者本人',
        agent: '受害者的代理人'
      },
      agentRelationshipOptions: {
        friend: '朋友',
        partner: '伴侶',
        family: '親屬',
        supportWorker: '救助工作者',
        other: '其他'
      },
      sexOptions: {
        placeholder: '請選擇',
        male: '男性',
        female: '女性',
        other: '其他性別認同'
      },
      sexIdentityOptions: {
        mtf: 'MtF',
        ftm: 'FtM',
        x: 'X',
        queer: 'Queer'
      },
      parentMotivationOptions: {
        internetAddiction: '"網癮" / 遊戲沉迷',
        studyIssues: '"厭學" / 學業問題',
        behaviorControl: '"叛逆" / 行為管教',
        mentalHealth: '精神或心理健康相關問題',
        genderIdentity: '性別認同相關（如跨性別等）',
        sexualOrientation: '性取向相關（如同性戀、雙性戀等）',
        familyViolence: '家庭衝突中的惡意施暴或懲罰手段',
        professionalAdvice: '諮詢師 / 醫生 / 老師等人士建議',
        relativesAdvice: '親屬或身邊人建議',
        advertising: '網路廣告或機構宣傳誤導',
        unknown: '不清楚 / 從未被告知原因',
        other: '其他原因'
      },
      violenceCategoryOptions: {
        falsePromotion: '虛假 / 非法宣傳',
        fakePolice: '冒充警察綁架',
        directPhysical: '直接接觸的肢體暴力（如搧耳光等）',
        toolPhysical: '使用工具的肢體暴力（如棍棒毆打、電擊等）',
        corporalPunishment: '體罰（如長跑等）',
        restriction: '限制自由（如綑綁等）',
        humiliation: '辱罵或公開羞辱',
        verbalSexual: '言語的性暴力（如性羞辱等）',
        physicalSexual: '肢體的性暴力（如性侵犯等）',
        solitary: '關禁閉',
        foodRestriction: '飲食限制或不健康飲食',
        sleepDeprivation: '睡眠剝奪',
        forcedMedication: '強迫服用藥物',
        genderConversion: '性別扭轉（如強迫改變外表等）',
        brainwashing: '精神控制或洗腦',
        other: '其他暴力行為'
      },
      exitMethodOptions: {
        pickedUp: '到期後家長接回',
        escape: '自行逃離',
        transfer: '被強制轉學',
        rescued: '被解救',
        closed: '機構關閉',
        other: '其他方式'
      },
      legalAidOptions: {
        yes: '是',
        no: '否',
        unsureHow: '想但不知道途徑',
        fearRetaliation: '擔心報復',
        other: '其他'
      },
      placeholders: {
        agentRelationship: '請選擇您與受害者的關係',
        agentRelationshipOther: '其他：請填寫您與受害者的關係',
        birthYear: '選擇年份',
        birthMonth: '選擇月份',
        birthDay: '選擇日期',
        age: '請輸入年齡',
        otherSexType: '請選擇',
        otherSex: '其他性別認同或補充說明',
        preInstitutionProvinceCode: '可選：選擇進入機構前所在省份',
        preInstitutionCityCode: '可選：請先選擇進入機構前所在省份',
        province: '選擇機構所在省份',
        city: '請先選擇機構所在省份',
        countyInitial: '可選：請先選擇機構所在城市 / 區縣',
        county: '可選：選擇機構所在縣區',
        countyUnavailable: '可選：當前機構所在城市無縣區可選',
        schoolName: '請填寫機構完整名稱',
        schoolAddress: '若已知，請詳細填寫機構地址',
        parentMotivationOther: '其他原因：請填寫具體原因',
        exitMethod: '可選：請選擇離開機構的方式',
        exitMethodOther: '其他方式：請填寫具體情況',
        experience: '請描述個人在校經歷、管理方式等...',
        legalAidStatus: '可選：請選擇目前情況',
        legalAidOther: '其他：請填寫補充說明',
        headmasterName: '姓名',
        abuserInfo: '可填寫施暴者姓名、聯繫方式、施暴內容等資訊。',
        contactInformation: '電話、郵箱或其他公開聯繫方式',
        violenceCategoryOther: '其他暴力行為：請填寫具體情況',
        scandal: '請描述已知的醜聞與暴力行為...',
        other: '任何您想補充的信息'
      },
      buttons: {
        openMap: '點擊可直接在地圖上選點',
        getCurrentLocation: '獲取目前位置',
        submit: '確認並提交信息',
        locating: '定位中...',
        submitting: '提交中...'
      },
      hints: {
        dateStart: '假如有多次被送入經歷，可在經歷描述中說明情況',
        dateEnd: '若目前仍在校，可不填',
        experience: '若描述別人經歷請在「其他補充」中填寫',
        otherSex: '請選擇 MtF / FtM / X / Queer，或點擊輸入框填寫其他性別認同或補充說明',
        selectedPoint: '選取點: {lat}, {lng}'
      },
      location: {
        filled: '已獲取目前位置: {lat}, {lng}',
        unsupported: '目前環境不支援定位，請使用 HTTPS 開啟網頁，或手動填寫經緯度 / 在地圖上選點。',
        permissionDenied: '定位權限已被拒絕，請允許存取位置信息後再試。',
        positionUnavailable: '暫時無法獲取目前位置，請稍後再試。',
        timeout: '獲取目前位置逾時，請稍後再試。',
        failed: '獲取目前位置失敗，請稍後再試。'
      },
      validation: {
        selectIdentity: '請選擇填寫身份',
        fillBirthDate: '請選擇出生年份',
        fillVictimBirthYear: '請選擇受害者出生年份',
        invalidBirthDate: '請填寫有效的{label}',
        fillAge: '請填寫年齡',
        ageRange: '年齡必須是 {min} 到 {max} 的整數',
        selectSex: '請選擇性別',
        selectVictimSex: '請選擇受害者性別',
        selectProvince: '請選擇機構所在省份',
        selectCity: '請選擇機構所在城市 / 區縣',
        fillSchoolName: '請填寫機構名稱',
        fillDateStart: '請填寫首次被送入日期',
        fillContactInformation: '請填寫機構聯繫方式',
        specifyOtherSex: '請選擇 MtF / FtM / X / Queer，或選擇輸入框填寫其他性別認同或補充說明',
        fillOtherSex: '請輸入其他性別認同或補充說明',
        fillAgentRelationshipOther: '請輸入您與受害者的關係',
        fillParentMotivations: '請至少選擇一項家長選擇矯正機構的原因 / 動機',
        fillParentMotivationOther: '請輸入其他原因',
        fillViolenceCategoryOther: '請輸入其他暴力行為',
        fillExitMethodOther: '請輸入其他離開機構的方式',
        fillLegalAidOther: '請輸入其他補充說明',
        endDateBeforeStart: '離開日期不能早於首次被送入日期'
      },
      standalone: {
        title: '扭轉機構受害者情況問卷調查',
        footerMeta: '全國統一心理援助：12356；青少年心理諮詢和法律援助：12355；希望熱線（全國性 24 小時心理危機干預）：400-161-9995',
        honeypotLabel: '網站',
        safetyNotice: '填寫過程中如感不適可隨時停止'
      }
    },
    institutionCorrection: {
      title: '機構資訊補充 / 修正',
      subtitle: '如果地圖中的機構資訊需要補充、修正或更新，可以在這裡提交。',
      privacyNotice: '隱私說明：此表單提交內容會依站點配置寫入 Google Form、D1 資料庫，或同時寫入兩者進行保存和整理。請盡量只填寫機構公開資訊，不要提交與此無關的個人敏感資訊。',
      backToMap: '返回地圖',
      sections: {
        institution: '機構資訊',
        correction: '補充 / 修正說明'
      },
      fields: {
        schoolName: '機構名稱',
        province: '機構所在省份',
        city: '機構所在城市 / 區縣',
        county: '機構所在縣區',
        schoolAddress: '機構地址',
        contactInformation: '機構聯繫方式',
        headmasterName: '負責人/校長姓名',
        correctionContent: '補充修正內容'
      },
      placeholders: {
        province: '可選：選擇機構所在省份',
        city: '可選：請先選擇機構所在省份',
        countyInitial: '可選：請先選擇機構所在城市 / 區縣',
        county: '可選：選擇機構所在縣區',
        countyUnavailable: '可選：當前機構所在城市無縣區可選',
        schoolName: '請填寫需要補充或修正的機構名稱',
        schoolAddress: '可選：填寫最新地址，或直接在地圖上選點 / 取得目前位置',
        contactInformation: '可選：電話、郵箱或其他公開聯繫方式',
        headmasterName: '可選：負責人 / 校長姓名',
        correctionContent: '請說明需要補充或修正的內容'
      },
      buttons: {
        openMap: '點擊可直接在地圖上選點',
        getCurrentLocation: '獲取目前位置',
        submit: '提交補充/修正',
        locating: '定位中...',
        submitting: '提交中...'
      },
      hints: {
        selectedPoint: '選取點: {lat}, {lng}',
        correctionContent: '例如：地址搬遷、聯繫方式變更、負責人資訊補充、地圖座標修正等。'
      },
      location: {
        filled: '已獲取目前位置: {lat}, {lng}',
        unsupported: '目前環境不支援定位，請使用 HTTPS 開啟網頁，或手動填寫經緯度 / 在地圖上選點。',
        permissionDenied: '定位權限已被拒絕，請允許存取位置信息後再試。',
        positionUnavailable: '暫時無法獲取目前位置，請稍後再試。',
        timeout: '獲取目前位置逾時，請稍後再試。',
        failed: '獲取目前位置失敗，請稍後再試。'
      },
      validation: {
        fillSchoolName: '請填寫機構名稱',
        invalidProvince: '請選擇有效的機構所在省份',
        provinceCityMismatch: '所選機構所在省份與城市 / 區縣不匹配',
        cityCountyMismatch: '所選機構所在城市 / 區縣與縣區不匹配'
      },
      success: {
        title: '補充 / 修正請求已收到',
        message: '感謝你的補充。我們會在核實後處理這條機構資訊修正請求。',
        backToMap: '返回地圖'
      },
      errorPage: {
        title: '補充 / 修正提交失敗',
        intro: '站內提交沒有成功。如果下方提供了已預填內容的 Google Form 連結，你也可以繼續在那裡提交。',
        privacyNote: '注意：下面這個連結包含你剛剛填寫的補充 / 修正內容，請不要隨意分享。',
        proxyNote: '提示：如果你目前的網路無法直接存取 Google 服務，打開 Google Form 頁面可能需要網路代理。',
        openFallback: '打開 Google Form 繼續提交',
        urlLabel: '帶預填內容的 Google Form 連結',
        backToForm: '返回補充 / 修正表單'
      },
      errors: {
        submitFailedPrefix: '提交失敗：',
        storageUnavailable: '機構資訊補充 / 修正功能暫時不可用，請稍後再試。',
        submitFailed: '提交失敗，請稍後再試。'
      }
    },
    map: {
      title: '機構地圖',
      sections: {
        stats: '統計數據',
        tags: '標籤',
        map: '地圖',
        allData: '所有數據'
      },
      note: '注：本地圖或許會有些許偏差',
      stats: {
        lastSynced: '數據最後一次更新：',
        updateNotice: '數據每 {seconds} 秒（{minutes} 分鐘）更新一次，如未看到您的提交，請耐心等待',
        submittedForms: '已提交表單：',
        provinceStats: '各省已知機構數量：',
        provinceSubmissions: '各省投稿量',
        averageAge: '受害者平均年齡：',
        secondsAgo: '{seconds} 秒前',
        refresh: '刷新',
        ageValue: '{age} 歲',
        schoolNum: '已統計學校數量'
      },
      tags: {
        title: '填寫類型',
        all: '全部',
        self: '受害者本人',
        agent: '受害者的代理人',
        bulk: '批量數據'
      },
      list: {
        searchPlaceholder: '檢索學校名、負責人、省份、地址、醜聞、聯繫方式等',
        searchButton: '檢索',
        noResults: '沒有符合檢索條件的結果',
        loadFailed: '數據加載失敗',
        translationLoading: '翻譯中...',
        translationUnavailable: '翻譯失敗',
        dateUnknown: '日期未標註',
        reportCounts: {
          self: '本人舉報',
          agent: '代理舉報'
        },
        pagination: {
          previous: '上一頁',
          next: '下一頁',
          page: '第 {current} / {total} 頁',
          form: '第 {current} / {total} 份表單'
        },
        formDetail: {
          button: '查看詳情頁',
          title: '表單詳細資訊',
          close: '關閉'
        },
        fields: {
          scandal: '學校醜聞：',
          experience: '受害者經歷：',
          other: '其他：',
          headmaster: '負責人：',
          province: '省份：',
          region: '城市 / 區縣：',
          address: '地址：',
          contact: '聯繫方式：'
        },
        viewDetails: '查看詳情頁'
      },
      record: {
        backToMap: '返回地圖列表',
        eyebrow: '提交詳情',
        loading: '正在載入提交詳情...',
        notFoundTitle: '找不到這份提交',
        notFoundBody: '這份提交可能已被合併、刪除，或暫時無法公開。你可以返回地圖列表繼續查看。',
        loadFailedTitle: '提交詳情載入失敗',
        loadFailedBody: '暫時無法載入這份提交，請稍後再試。',
        documentTitle: '{school} | {site}'
      },
      api: {
        summary: '想要調用 API？',
        privacy: '我們明確表示：我們永遠不會洩露受訪者的任何敏感性資料。',
        beforeUse: '在調用 API 之前，請注意：公開介面僅提供目前在地圖頁面上展示的資料。',
        implementationTitle: '我們如何實現的？',
        implementationBody: '首先你的表單會透過 Vercel 上傳到 Google Forms，在那裡生成一個電子表格。站長在其表格的 Apps Script 中部署了應用程式，會將地址一欄轉化為經緯度並保存在表格中。然後 Google 側會生成一個原始 JSON API。因為那個 API 包含全部資訊，所以不會公開。本站再從中取出需要的訊息，生成當前對外開放的 API。',
        opinionTitle: '我們的看法：',
        opinionBody: '我們很希望你們使用這個 API 並接入到你們的網站上。即使網站被封禁，資料仍然可以透過 API 在不同網絡中繼續傳播。這也是一種去中心化。',
        cta: '知道了這些，你就可以使用我們的 API 了。歡迎把它接入到你們的網站。',
        link: '獲取 API 數據源',
        correctionHint: '如果你發現地圖中的機構資料需要補充或修正，也可以透過下面的表單告訴我們。',
        correctionButton: '機構資訊補充/修正'
      }
    },
    about: {
      title: '關於我們',
      friendLinks: '致謝',
      ownership: '本項目由 TRANS UNION 維護與開發 ，透過Apachi-2.0 License開源',
      origin: '本網站建站於 2026 年 2 月 21 日，最初由倖存者社群協作建立。',
      thanks: '在這裡衷心感謝以下項目、企業和個人為本項目提供了免費的援助，沒有他們就沒有這個網站的誕生：',
      friendDescriptions: {
        nanmuxue: '程式碼重構',
        hermaphroditus: '域名貢獻者',
        muyuan: '社群傳播、資料提供',
        amber: '社群建立'
      }
    },
    privacy: {
      title: '隱私政策與 Cookie 說明',
      intro: '本頁面說明本站在頁面造訪、表單提交與公開展示過程中會如何處理相關資訊。',
      meta: {
        effectiveDateLabel: '生效日期',
        effectiveDateValue: '2026年4月9日',
        updatedLabel: '最近更新',
        updatedValue: '2026年4月12日',
        scopeLabel: '適用範圍',
        scopeValue: '本站頁面、表單提交流程與相關公開展示內容'
      },
      tocLabel: '隱私說明目錄',
      highlights: {
        submissionTitle: '表單提交',
        submissionBody: '表單內容由本站接收後，交由 Google Form / Google 試算表保存與整理。',
        publicTitle: '公開展示',
        publicBody: '與機構曝光相關的內容可能整理後在本站公開頁面展示。',
        cookieTitle: '站內 Cookie',
        cookieBody: '目前僅使用一個語言偏好 Cookie，不用於廣告、跨站追蹤或人物畫像分析。'
      },
      sections: {
        summary: '概覽',
        formSubmission: '表單填寫與公開展示',
        thirdParty: '第三方服務',
        retention: '保存期限與刪除',
        security: '安全措施',
        cookie: '目前使用的 Cookie',
        manage: '您的選擇',
        EULA: '最終用戶許可協議',
        contact: '聯絡我們',
        publicInfo: '公開資料'
      },
      summary: '本站目前僅在您主動切換語言時，使用一個站內 Cookie 來記住您的語言偏好。我們不會將該 Cookie 用於廣告投放、跨站追蹤或人物畫像分析。',
      overviewItems: [
        '當您瀏覽本站時，我們目前只會在您主動切換語言時寫入一個語言偏好 Cookie。',
        '當您填寫表單時，出生年份、性別等個人基本資訊主要用於內部整理、核驗與統計，不在本站公開頁面直接展示。',
        '與機構曝光相關的內容在整理後，可能出現在本站公開頁面、地圖或相關展示模組中。'
      ],
      formLead: '表單提交通常會同時涉及內部處理資訊與可能公開展示的資訊。',
      formItems: [
        '內部處理資訊通常包括出生年份、性別等個人基本資訊，用於內部整理、核驗與統計。',
        '可能公開展示的資訊通常包括相關經歷、機構名稱、所在地區、機構地址、機構聯繫方式、負責人／校長姓名、醜聞及暴力行為描述和其他補充內容。',
        '如果您點擊「取得目前位置」等定位按鈕，瀏覽器會請求定位權限；定位結果僅用於協助填入目前地址或經緯度，只有在您確認並提交表單後才會隨表單一併送出。',
        '請不要在可能公開的欄位中填寫身分證號、私人電話、家庭住址、即時通訊帳號或其他不適合公開的個人敏感資訊。'
      ],
      cookieIntro: '本站目前使用的 Cookie 如下：',
      cookieFields: {
        name: '名稱',
        purpose: '用途',
        trigger: '寫入時機',
        retention: '保存期限',
        scope: '作用範圍',
        attributes: '附加屬性'
      },
      cookieValues: {
        purpose: '記住您選擇的介面語言，避免下次造訪時重複切換。',
        trigger: '當您透過頁面語言切換器造訪帶有 ?lang=... 的網址，且新語言與現有設定不同時寫入。',
        retention: '最長 30 天（Max-Age=2592000）。',
        scope: '本站根路徑 / 下的頁面。',
        attributes: 'SameSite=Lax。'
      },
      thirdPartyLead: '為完成表單保存與部分功能展示，本站可能使用以下第三方服務：',
      thirdPartyItems: [
        'Google Form / Google 試算表：用於保存和整理表單提交內容。',
        'Google Cloud Translation（啟用時）：當站內翻譯功能開啟時，部分公開展示文本可能送至翻譯服務處理。',
        '地圖底圖與靜態資源 CDN：地圖頁面可能向相應服務載入公開底圖或前端依賴資源。'
      ],
      retentionItems: [
        '語言偏好 Cookie 最長保存 30 天，或直到您主動刪除。',
        '表單提交內容會按照項目營運、核驗、統計、公開展示與後續整理需要保留；如需溝通更正或刪除，請透過本頁聯絡方式聯絡維護者。',
        '伺服器側運行日誌與限流記錄僅保留排查與安全防護所需的最小元資訊，不會主動在審計日誌中記錄整份表單正文。'
      ],
      securityItems: [
        '本站對表單提交流程使用服務端校驗、限流、防刷 token、蜜罐欄位和敏感頁面禁快取等措施。',
        '我們會盡量減少在日誌與公開接口中暴露不必要的資訊，並對公開展示資料進行欄位級篩選。',
        '但任何聯網傳輸或第三方服務都無法承諾絕對安全；請在提交時自行避免填寫不必要的個人敏感資訊。'
      ],
      manageItems: [
        '您可以選擇不提交表單，或僅填寫您願意提供的必要資訊。',
        '您可以隨時透過瀏覽器設定刪除或封鎖語言偏好 Cookie；刪除後，網站會恢復為預設語言。',
        '如果您希望溝通更正、刪除或下架與您相關的內容，請透過下方電子郵件聯絡項目維護者。'
      ],EULAItems: [
        '本網站一切存儲、DNS行爲均在中華人民共和國香港特別行政區進行，受到DPO（香港個人資料（私隱）政策）、LPDP（個人資料保護法第8/2005號法令）約束。',
        '本網站係中華人民共和國大陸地區學生人權相關議題，理應視爲境内網站，且服務器位於境内，故一切存儲、DNS行爲均視爲在中華人民共和國境内進行，受到中國大陸相關法律約束。',
        '因本項目的人權倡議性質，我們不排除在其他司法管轄区也可能受到相关法律约束的可能性，且我们会尊重并遵守所有适用的法律法规。',
        '因爲相關議題中受影響群體包含部分LGBTQIA群體，因此在設計時我們特別注意了對性別選項的設置，并非任何政治正確的妥協，而是基於對受害者群體的尊重和理解。基於此我們不會對任何勢力的政治正確妥協，請不要對我們的性別選項進行無端的政治正確批評。'
      ],
      contactBody: '如果您對本站隱私說明、表單公開範圍或內容處理方式有疑問，可以透過以下方式聯絡項目維護者：'
    },
    submitSuccess: {
      badge: '成功',
      title: '提交成功！感謝您的參與。',
      message: '我們已經收到了您的表單，感謝您的參與。您的參與將是我們前進的動力！',
      backForm: '返回問卷',
      backHome: '返回首頁',
      petition: '抵制扭轉機構簽名會'
    },
    submitStatus: {
      title: '調試提交結果',
      mode: '提交模式：',
      successfulTargets: '成功目標：',
      failedTargets: '失敗目標：',
      error: '錯誤：',
      none: '無',
      targets: {
        both: 'Google Form + D1',
        d1: 'D1 資料庫',
        google: 'Google Form'
      }
    },
    submitPreview: {
      badge: '預覽',
      title: '表單乾跑預覽',
      intro: '這次提交還沒有發送到實際提交目標。下面是本次本地組裝出的最終欄位和值。',
      targetUrl: 'Google Form 目標網址（若已啟用）：',
      columns: {
        entry: 'Google Form Entry',
        field: '欄位',
        value: '值'
      },
      payloadEyebrow: '提交負載',
      payload: 'URL Encoded Payload',
      backForm: '返回表單'
    },
    submitConfirm: {
      badge: '確認',
      title: '提交確認',
      intro: '這一步還沒有發送到實際提交目標。請確認以下內容無誤後，再正式提交。',
      targetUrl: '目標網址：',
      columns: {
        entry: 'Google Form Entry',
        field: '欄位',
        value: '值'
      },
      confirm: '確認並提交',
      confirming: '提交中...',
      backForm: '返回表單'
    },
    submitError: {
      badge: '重試',
      title: '提交失敗',
      intro: '站內提交沒有成功。如果下方提供了已預填內容的 Google Form 連結，你也可以繼續在那裡提交。',
      privacyNote: '注意：下面這個連結包含你剛剛填寫的表單內容，請不要隨意分享。',
      proxyNote: '提示：如果你目前的網路無法直接存取 Google 服務，打開 Google Form 頁面可能需要網路代理。',
      openFallback: '打開 Google Form 繼續提交',
      urlLabel: '帶預填內容的 Google Form 連結',
      backForm: '返回表單'
    },
    maintenance: {
      badge: '站點維護中',
      title: '網站正在維護中',
      description: '為了帶來更穩定的體驗，站點正在升級與校驗。頁面、表單與 API 暫時不可用。',
      siteLabel: '站點',
      modeLabel: '服務狀態',
      defaultNotice: '維護模式已開啟',
      refresh: '重新嘗試'
    },
    fields: {
      birthDate: '出生年月日',
      birthYear: '出生年份',
      victimBirthYear: '受害者出生年份',
      birthMonth: '出生月份',
      birthDay: '出生日期',
      age: '年齡',
      identity: '填寫身份',
      agentRelationship: '您與受害者的關係？',
      sex: '性別',
      victimSex: '受害者性別',
      sexOther: '其他性別認同或補充說明',
      preInstitutionProvinceCode: '進入機構前所在省份？',
      preInstitutionCityCode: '進入機構前所在城市？',
      provinceCode: '機構所在省份',
      cityCode: '機構所在城市 / 區縣',
      countyCode: '機構所在縣區',
      parentMotivations: '家長選擇矯正機構的原因 / 動機？',
      parentMotivationOther: '家長選擇矯正機構的原因 / 動機（其他原因）',
      schoolName: '機構名稱',
      schoolAddress: '機構地址',
      dateStart: '首次被送入日期',
      dateEnd: '離開日期',
      exitMethod: '離開機構的方式',
      exitMethodOther: '離開機構的方式（其他方式）',
      experience: '個人在校經歷描述',
      headmasterName: '負責人/校長姓名',
      abuserInfo: '已知施暴者 / 教官基本資訊與描述',
      contactInformation: '機構聯繫方式',
      violenceCategories: '機構醜聞及暴力行為',
      violenceCategoryOther: '機構醜聞及暴力行為（其他暴力行為）',
      scandal: '醜聞及暴力行為詳細描述',
      legalAidStatus: '舉報或尋求法律援助情況',
      legalAidOther: '舉報或尋求法律援助情況（其他）',
      other: '其他補充'
    },
    previewFields: {
      birthDate: '出生年月日',
      province: '機構所在省份',
      city: '機構所在城市 / 區縣',
      schoolName: '機構名稱',
      identity: '填寫身份',
      sex: '性別',
      schoolAddress: '機構地址',
      experience: '個人在校經歷描述',
      headmasterName: '負責人/校長姓名',
      contactInformation: '機構聯繫方式',
      scandal: '醜聞及暴力行為詳細描述',
      other: '其他補充',
      dateStart: '首次被送入日期',
      dateEnd: '離開日期'
    },
    formErrors: {
      required: '{label}為必填',
      maxLength: '{label}不能超過 {maxLength} 字',
      invalidBirthDate: '請填寫有效的{label}',
      ageRange: '{label}必須是 {min} 到 {max} 的整數',
      invalidIdentity: '請選擇有效的填寫身份',
      invalidChoice: '{label}選項無效',
      invalidSex: '性別不合法，請修改',
      otherSexRequired: '選擇其他性別認同時，請選擇 MtF / FtM / X / Queer，或選擇輸入框填寫其他性別認同或補充說明',
      provinceCityMismatch: '機構所在省份和機構所在城市 / 區縣不匹配',
      preInstitutionProvinceCityMismatch: '進入機構前所在省份和進入機構前所在城市不匹配',
      cityCountyMismatch: '機構所在城市 / 區縣和機構所在縣區不匹配',
      invalidFormat: '{label}格式不正確',
      endDateBeforeStart: '{endLabel}不能早於{startLabel}'
    },
    server: {
      submitFailedPrefix: '提交失敗：',
      submitFailed: '提交失敗',
      invalidFormSubmission: '提交已失效或異常，請重新整理頁面後再試。',
      maintenanceActive: '站點正在維護中，請稍後再試。',
      tooManyRequests: '請求過於頻繁，請稍後再試。',
      mapDataUnavailable: '無法取得地圖數據',
      areaOptionsUnavailable: '無法取得地區選項'
    },
    debug: {
      title: '調試',
      intro: '此頁面僅在 DEBUG_MOD=true 時可用。',
      sections: {
        request: '請求與運行時',
        site: '站點配置',
        integrations: '整合狀態',
        limits: '限流與表單參數',
        tools: '調試工具'
      },
      labels: {
        language: '語言',
        requestPath: '目前路徑',
        runtime: '運行時',
        assetVersion: '資源版本',
        siteTitle: '站點標題',
        siteUrl: '站點位址',
        apiUrl: 'API 位址',
        debugMode: '調試模式',
        formDryRun: '表單 Dry Run',
        formSubmitTarget: '表單提交目標',
        correctionSubmitTarget: '補充 / 修正提交目標',
        maintenanceMode: '維護模式',
        maintenanceRetryAfter: '維護重試時間',
        trustProxy: 'Trust Proxy',
        mapNodeTransport: 'Node 地圖傳輸覆寫',
        googleForm: 'Google Form 提交位址',
        correctionGoogleForm: '補充 / 修正 Google Form',
        googleScript: '私有地圖上游',
        publicMapDataUrl: '公開地圖回退源',
        translationProvider: '翻譯服務',
        redisRateLimit: 'Redis 限流儲存',
        formProtectionSecret: '表單保護 Secret',
        pageReadLimit: '頁面讀取限流',
        mapReadLimit: '地圖讀取限流',
        submitRateLimit: '提交限流',
        mapUpstreamTimeout: '地圖上游逾時',
        translationTimeout: '翻譯服務逾時',
        minFillMs: '最短填寫時長',
        maxAgeMs: '表單 Token 有效期'
      },
      values: {
        enabled: '已啟用',
        disabled: '未啟用',
        configured: '已配置',
        missing: '未配置',
        unknown: '未知',
        explicit: '顯式配置',
        derived: '派生值',
        memoryOnly: '僅記憶體模式',
        publicFallbackOnly: '僅公開回退',
        node: 'Node.js',
        workers: 'Cloudflare Workers',
        limitWindow: '每 {minutes} 分鐘 {count} 次',
        milliseconds: '{count} ms',
        seconds: '{count} s'
      },
      samples: {
        d1SkippedError: '調試模擬略過了真實的 D1 寫入。',
        form: {
          schoolName: '調試預覽學院',
          schoolAddress: '洛江區調試路 12 號',
          experience: '用於檢查版面與多語言展示的調試預覽內容。',
          headmasterName: '調試負責人',
          contactInformation: 'debug-preview@example.com',
          scandal: '僅用於調試的醜聞摘要佔位內容。',
          other: '僅用於調試的其他補充內容。'
        },
        correction: {
          schoolName: '調試修正學院',
          schoolAddress: '洛江區修正調試路 5 號',
          contactInformation: 'debug-correction@example.com',
          headmasterName: '調試修正負責人',
          correctionContent: '用於檢查 Google Form 回退連結和結果頁版面的調試修正內容。'
        }
      },
      submitTargets: {
        both: 'Google Form + D1',
        d1: 'D1 資料庫',
        google: 'Google Form'
      },
      links: {
        submitErrorPreview: '查看提交失敗頁預覽',
        submitPreview: '查看提交預覽頁',
        submitConfirm: '查看提交確認頁',
        correctionSubmitSuccessPreview: '查看補充 / 修正成功頁預覽',
        correctionSubmitErrorPreview: '查看補充 / 修正失敗頁預覽'
      }
    },
    data: {
      inputTypes: {
        self: '受害者本人',
        agent: '受害者的代理人',
        bulk: '批量數據'
      },
      provinceNames: buildLocalizedLegacyProvinceNames('zh-TW')
    }
  },
  en: {
    common: {
      siteName: 'NO CONVERSION THERAPY',
      language: 'Language',
      switchLanguage: 'Apply',
      footerNavLabel: 'Footer',
      languages: {
        'zh-CN': '简中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 N·C·T Project.',
      loading: 'Loading...',
      notFound: 'Not Found'
    },
    pageTitles: {
      home: 'Home | {title}',
      form: 'Form | {title}',
      institutionCorrection: 'Institution Correction | {title}',
      institutionCorrectionSuccess: 'Correction Submitted | {title}',
      institutionCorrectionError: 'Correction Submission Failed | {title}',
      map: 'Map | {title}',
      mapRecord: 'Submission Detail | {title}',
      about: 'About | {title}',
      privacy: 'Privacy & Cookie Notice | {title}',
      submitPreview: 'Submission Preview | {title}',
      submitConfirm: 'Submission Confirmation | {title}',
      submitError: 'Submission Failed | {title}',
      blog: 'Library | {title}',
      article: '{articleTitle} | {title}',
      debug: 'Debug | {title}',
      maintenance: 'Maintenance | {title}'
    },
    navigation: {
      home: 'Back to Home',
      about: 'About Us',
      privacy: 'Privacy / Cookie Notice',
      allArticles: 'All Articles'
    },
    index: {
      tagline: 'Every sincere voice finds its resonance, enough to rend the warped fetters within the wilderness of bigotry.',
      fillForm: 'Form',
      viewMap: 'Map',
      blogLibrary: 'Library'
    },
    blog: {
      title: 'NCT.Blogs',
      subtitle: 'There may be something useful here.',
      all: 'All',
      author: 'Author: ',
      creationDate: 'Created: ',
      language: 'Language: ',
      noTag: '#No Tag',
      empty: 'No articles yet.',
      articleNotFound: 'Article not found',
      articleLanguages: {
        zhCN: 'Simplified Chinese',
        zhTW: 'Traditional Chinese',
        en: 'English'
      },
      tags: {
        '1': 'Updates',
        '2': 'Announcements',
        '3': 'Memoir',
        '4': 'Essays',
        '5': 'Law',
        '6': 'Featured',
        '7': 'Obituary'
      }
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: 'We document the darkness in order to welcome the light.',
      privacyNotice: 'Privacy notice: personal details such as birth year and sex provided in this questionnaire will be kept strictly confidential, while related experiences and institution exposure information may be made public in the future. Please do not include ID numbers, private phone numbers, home addresses, or other sensitive personal information in fields that may be made public.',
      sections: {
        basic: 'Personal Information',
        experience: 'Related Experience',
        victimExperience: 'Survivor Experience',
        exposure: 'Institution Exposure Information'
      },
      fields: {
        identity: 'What is your relationship to this submission?',
        agentRelationship: 'What is your relationship to the survivor?',
        birthDate: 'Date of Birth',
        birthYear: 'Birth Year',
        victimBirthYear: 'Survivor Birth Year',
        birthMonth: 'Birth Month',
        birthDay: 'Birth Day',
        age: 'Age',
        sex: 'Gender',
        victimSex: 'Survivor Gender',
        preInstitutionProvinceCode: 'Province Before Entering the Institution',
        preInstitutionCityCode: 'City Before Entering the Institution',
        province: 'Institution Province',
        city: 'Institution City / District',
        county: 'Institution County / District',
        schoolName: 'Institution Name',
        schoolAddress: 'Institution Address',
        dateStart: 'First Date Sent There',
        dateEnd: 'Departure Date',
        parentMotivations: 'Why Did the Parent(s) Choose the Institution?',
        exitMethod: 'How Did the Survivor Leave the Institution?',
        experience: 'Personal Institutional Experience Description',
        legalAidStatus: 'Was This Experience Reported or Taken to Legal Aid?',
        headmasterName: 'Principal / Person in Charge',
        abuserInfo: 'Known Information and Description of Abusers / Drill Instructors',
        contactInformation: 'Institution Contact Information',
        violenceCategories: 'Scandals and Violence at the Institution (select all that match your experience or what you witnessed)',
        scandal: 'Detailed Description of Scandals and Violent Behavior',
        other: 'Additional Notes'
      },
      identityOptions: {
        self: 'The survivor themself',
        agent: 'A representative of the survivor'
      },
      agentRelationshipOptions: {
        friend: 'Friend',
        partner: 'Partner',
        family: 'Family member',
        supportWorker: 'Support worker',
        other: 'Other'
      },
      sexOptions: {
        placeholder: 'Please select',
        male: 'Male',
        female: 'Female',
        other: 'Other gender identity'
      },
      sexIdentityOptions: {
        mtf: 'MtF',
        ftm: 'FtM',
        x: 'X',
        queer: 'Queer'
      },
      parentMotivationOptions: {
        internetAddiction: '"Internet addiction" / gaming',
        studyIssues: '"School refusal" / academic issues',
        behaviorControl: '"Rebelliousness" / behavior control',
        mentalHealth: 'Mental health or psychological concerns',
        genderIdentity: 'Gender identity related (such as being transgender)',
        sexualOrientation: 'Sexual orientation related (such as being gay or bisexual)',
        familyViolence: 'Malicious abuse or punishment amid family conflict',
        professionalAdvice: 'Suggested by a counselor / doctor / teacher / similar authority',
        relativesAdvice: 'Suggested by relatives or people nearby',
        advertising: 'Misled by online ads or institutional promotion',
        unknown: 'Unknown / never told the reason',
        other: 'Other reason'
      },
      violenceCategoryOptions: {
        falsePromotion: 'False / illegal promotion',
        fakePolice: 'Kidnapping while impersonating police',
        directPhysical: 'Direct physical violence (such as slapping)',
        toolPhysical: 'Physical violence with tools (such as beatings or electric shocks)',
        corporalPunishment: 'Corporal punishment (such as forced running)',
        restriction: 'Restriction of freedom (such as tying someone up)',
        humiliation: 'Insults or public humiliation',
        verbalSexual: 'Verbal sexual violence (such as sexual humiliation)',
        physicalSexual: 'Physical sexual violence (such as assault)',
        solitary: 'Solitary confinement',
        foodRestriction: 'Food restriction or unhealthy diet',
        sleepDeprivation: 'Sleep deprivation',
        forcedMedication: 'Forced medication',
        genderConversion: 'Gender conversion practices (such as forced appearance changes)',
        brainwashing: 'Psychological control or brainwashing',
        other: 'Other violent behavior'
      },
      exitMethodOptions: {
        pickedUp: 'Picked up by parents after the term ended',
        escape: 'Escaped independently',
        transfer: 'Forced transfer',
        rescued: 'Rescued',
        closed: 'Institution shut down',
        other: 'Other method'
      },
      legalAidOptions: {
        yes: 'Yes',
        no: 'No',
        unsureHow: 'Wanted to, but did not know how',
        fearRetaliation: 'Worried about retaliation',
        other: 'Other'
      },
      placeholders: {
        agentRelationship: 'Select the relationship to the survivor',
        agentRelationshipOther: 'Other: describe the relationship to the survivor',
        birthYear: 'Select year',
        birthMonth: 'Select month',
        birthDay: 'Select day',
        age: 'Enter age',
        otherSexType: 'Please select',
        otherSex: 'Another gender identity or additional notes',
        preInstitutionProvinceCode: 'Optional: select the province before entering the institution',
        preInstitutionCityCode: 'Optional: select the province before entering the institution first',
        province: 'Select the institution province',
        city: 'Select the institution province first',
        countyInitial: 'Optional: select the institution city / district first',
        county: 'Optional: select the institution county / district',
        countyUnavailable: 'Optional: no county / district available for the selected institution city',
        schoolName: 'Please enter the full institution name',
        schoolAddress: 'If known, please provide the institution address in as much detail as possible',
        parentMotivationOther: 'Other reason: describe the reason',
        exitMethod: 'Optional: select how the survivor left the institution',
        exitMethodOther: 'Other method: describe how they left',
        experience: 'Describe the personal experience at the institution, management style, and other details...',
        legalAidStatus: 'Optional: select the current situation',
        legalAidOther: 'Other: add a short note',
        headmasterName: 'Name',
        abuserInfo: 'You can add names, contact details, violent acts, and other known information.',
        contactInformation: 'Phone, email, or another public contact method',
        violenceCategoryOther: 'Other violent behavior: describe it briefly',
        scandal: 'Describe known scandals and violent behavior...',
        other: 'Anything else you would like to add'
      },
      buttons: {
        openMap: 'Pick a point directly on the map',
        getCurrentLocation: 'Use current location',
        submit: 'Confirm and Submit',
        locating: 'Locating...',
        submitting: 'Submitting...'
      },
      hints: {
        dateStart: 'If the survivor was sent there more than once, please explain that in the experience description.',
        dateEnd: 'Leave blank if the survivor is still there',
        experience: 'If you are describing someone else’s experience, please add that in "Additional Notes".',
        otherSex: 'Choose MtF / FtM / X / Queer, or use the text field for another gender identity or additional notes.',
        selectedPoint: 'Selected point: {lat}, {lng}'
      },
      location: {
        filled: 'Current location captured: {lat}, {lng}',
        unsupported: 'Location is not available in this environment. Please open the page over HTTPS, or enter coordinates manually / pick a point on the map.',
        permissionDenied: 'Location permission was denied. Please allow access to your location and try again.',
        positionUnavailable: 'Your current location is temporarily unavailable. Please try again later.',
        timeout: 'Getting your current location timed out. Please try again.',
        failed: 'Failed to get your current location. Please try again.'
      },
      validation: {
        selectIdentity: 'Please choose your submission role',
        fillBirthDate: 'Please select a birth year',
        fillVictimBirthYear: 'Please select the survivor birth year',
        invalidBirthDate: 'Please enter a valid {label}',
        fillAge: 'Please enter age',
        ageRange: 'Age must be an integer between {min} and {max}',
        selectSex: 'Please choose gender',
        selectVictimSex: 'Please choose the survivor gender',
        selectProvince: 'Please choose the institution province',
        selectCity: 'Please choose the institution city / district',
        fillSchoolName: 'Please enter the institution name',
        fillDateStart: 'Please enter the first date sent there',
        fillContactInformation: 'Please enter the institution contact information',
        specifyOtherSex: 'Please choose MtF / FtM / X / Queer, or choose the text field and enter another gender identity or additional notes',
        fillOtherSex: 'Please enter another gender identity or additional notes',
        fillAgentRelationshipOther: 'Please describe the relationship to the survivor',
        fillParentMotivations: 'Please choose at least one reason why the parent(s) chose the institution',
        fillParentMotivationOther: 'Please enter the other reason',
        fillViolenceCategoryOther: 'Please describe the other violent behavior',
        fillExitMethodOther: 'Please describe the other departure method',
        fillLegalAidOther: 'Please enter the additional note',
        endDateBeforeStart: 'Departure date cannot be earlier than the first date sent there'
      },
      standalone: {
        title: 'Survey on Harm Experienced in Conversion Institutions',
        footerMeta: 'National mental health support: 12356; youth counseling and legal aid: 12355; Hope Hotline (nationwide 24/7 crisis intervention): 400-161-9995',
        honeypotLabel: 'Website',
        safetyNotice: 'If you feel uncomfortable at any point while filling this out, you can stop at any time'
      }
    },
    institutionCorrection: {
      title: 'Institution Information Correction',
      subtitle: 'Use this form if an institution shown on the map needs additional details, corrections, or updates.',
      privacyNotice: 'Privacy notice: submissions from this form may be written to Google Form, the D1 database, or both depending on the site configuration. Please provide institution-facing public information only, and avoid unrelated personal sensitive information.',
      backToMap: 'Back to Map',
      sections: {
        institution: 'Institution Information',
        correction: 'Correction Details'
      },
      fields: {
        schoolName: 'Institution Name',
        province: 'Institution Province',
        city: 'Institution City / District',
        county: 'Institution County / District',
        schoolAddress: 'Institution Address',
        contactInformation: 'Institution Contact Information',
        headmasterName: 'Principal / Person in Charge',
        correctionContent: 'Correction Details'
      },
      placeholders: {
        province: 'Optional: select the institution province',
        city: 'Optional: select the institution province first',
        countyInitial: 'Optional: select the institution city / district first',
        county: 'Optional: select the institution county / district',
        countyUnavailable: 'Optional: no county / district is available for the selected city',
        schoolName: 'Enter the institution name that needs correction or supplementation',
        schoolAddress: 'Optional: provide an updated address, or pick a point on the map / use the current location',
        contactInformation: 'Optional: phone, email, or another public contact method',
        headmasterName: 'Optional: principal / person in charge',
        correctionContent: 'Describe what should be corrected or added'
      },
      buttons: {
        openMap: 'Pick a point directly on the map',
        getCurrentLocation: 'Use current location',
        submit: 'Submit Correction',
        locating: 'Locating...',
        submitting: 'Submitting...'
      },
      hints: {
        selectedPoint: 'Selected point: {lat}, {lng}',
        correctionContent: 'Examples: relocation, updated contacts, added principal information, corrected map coordinates.'
      },
      location: {
        filled: 'Current location captured: {lat}, {lng}',
        unsupported: 'Location is not available in this environment. Please open the page over HTTPS, or enter coordinates manually / pick a point on the map.',
        permissionDenied: 'Location permission was denied. Please allow access to your location and try again.',
        positionUnavailable: 'Your current location is temporarily unavailable. Please try again later.',
        timeout: 'Getting your current location timed out. Please try again.',
        failed: 'Failed to get your current location. Please try again.'
      },
      validation: {
        fillSchoolName: 'Please enter the institution name',
        invalidProvince: 'Please choose a valid institution province',
        provinceCityMismatch: 'The selected institution province and city / district do not match',
        cityCountyMismatch: 'The selected institution city / district and county / district do not match'
      },
      success: {
        title: 'Correction request received',
        message: 'Thank you for the update. We will review this institution correction request and process it after verification.',
        backToMap: 'Back to Map'
      },
      errorPage: {
        title: 'Correction submission failed',
        intro: 'The in-site correction submission did not complete successfully. If a prefilled Google Form fallback link is available below, you can continue there.',
        privacyNote: 'Note: the link below contains the correction details you just entered, so please do not share it casually.',
        proxyNote: 'Note: if your current network cannot access Google services directly, opening the Google Form page may require a network proxy.',
        openFallback: 'Open Google Form to Continue',
        urlLabel: 'Prefilled Google Form Link',
        backToForm: 'Back to Correction Form'
      },
      errors: {
        submitFailedPrefix: 'Submission failed: ',
        storageUnavailable: 'The institution correction form is temporarily unavailable. Please try again later.',
        submitFailed: 'Submission failed. Please try again later.'
      }
    },
    map: {
      title: 'Institution Map',
      sections: {
        stats: 'Statistics',
        tags: 'Tags',
        map: 'Map',
        allData: 'All Records'
      },
      note: 'Note: this map may contain small positional inaccuracies.',
      stats: {
        lastSynced: 'Last data update:',
        updateNotice: 'Data refreshes every {seconds} seconds ({minutes} minutes). If your submission is not visible yet, please wait a little longer.',
        submittedForms: 'Submitted forms:',
        provinceStats: 'Known institutions by province:',
        provinceSubmissions: 'Submission counts by province',
        averageAge: 'Average age of survivors:',
        secondsAgo: '{seconds} seconds ago',
        refresh: 'Refresh',
        ageValue: '{age} years old',
        schoolNum: 'Number of schools already counted'
      },
      tags: {
        title: 'Submission Type',
        all: 'All',
        self: 'Survivor',
        agent: 'Survivor Representative',
        bulk: 'Bulk Data'
      },
      list: {
        searchPlaceholder: 'Search school names, principals, provinces, addresses, scandals, contacts, and more',
        searchButton: 'Search',
        noResults: 'No records matched the search criteria',
        loadFailed: 'Failed to load data',
        translationLoading: 'Translating...',
        translationUnavailable: 'Translation unavailable',
        dateUnknown: 'Date unavailable',
        reportCounts: {
          self: 'Self reports',
          agent: 'Agent reports'
        },
        pagination: {
          previous: 'Previous',
          next: 'Next',
          page: 'Page {current} of {total}',
          form: 'Submission {current} of {total}'
        },
        formDetail: {
          button: 'View detail page',
          title: 'Form details',
          close: 'Close'
        },
        fields: {
          scandal: 'School scandals:',
          experience: 'Survivor experience:',
          other: 'Additional Notes:',
          headmaster: 'Principal:',
          province: 'Province:',
          region: 'City / District:',
          address: 'Address:',
          contact: 'Contact:'
        },
        viewDetails: 'Open detail page'
      },
      record: {
        backToMap: 'Back to Map List',
        eyebrow: 'Submission Detail',
        loading: 'Loading submission details...',
        notFoundTitle: 'This submission could not be found',
        notFoundBody: 'This submission may have been merged, removed, or is temporarily unavailable. You can return to the map list and keep browsing.',
        loadFailedTitle: 'Failed to load this submission',
        loadFailedBody: 'The submission detail page is temporarily unavailable. Please try again later.',
        documentTitle: '{school} | {site}'
      },
      api: {
        summary: 'Want to use the API?',
        privacy: 'We make this clear: we will never disclose any sensitive information about respondents.',
        beforeUse: 'Before using the API, please note that the public endpoint only includes data currently shown on the map.',
        implementationTitle: 'How does it work?',
        implementationBody: 'First, your submission is sent through Vercel to Google Forms, where it is stored in a spreadsheet. An Apps Script attached to that spreadsheet converts addresses into latitude and longitude and stores the coordinates. Google then exposes a raw JSON API. Because that raw API contains all information, it is kept private. This site extracts only the required fields and exposes the public API you can use.',
        opinionTitle: 'Why we want this used:',
        opinionBody: 'We genuinely hope you will use this API and integrate it into your own websites. Even if the main site is blocked, the data can continue to circulate through the API. That is one form of decentralization.',
        cta: 'Now that you know how it works, feel free to use the API and integrate it into your site.',
        link: 'Get the API data source',
        correctionHint: 'If any institution information on the map needs to be supplemented or corrected, you can also tell us through the form below.',
        correctionButton: 'Institution Correction'
      }
    },
    about: {
      title: 'About Us',
      friendLinks: 'THANKS',
      ownership: 'This project belongs to the TRANS UNION team, which holds all related intellectual property rights.',
      origin: 'This website went online on February 21, 2026 and was originally built through survivor collaboration.',
      thanks: 'We sincerely thank the following projects, organizations, and individuals for helping make this website possible:',
      friendDescriptions: {
        nanmuxue: 'Code refactoring',
        hermaphroditus: 'Domain contributor',
        muyuan: 'Community outreach and source material support',
        amber: 'Community building'
      }
    },
    privacy: {
      title: 'Privacy & Cookie Notice',
      intro: 'This page explains how the site handles information related to page visits, form submissions, and public display content.',
      meta: {
        effectiveDateLabel: 'Effective Date',
        effectiveDateValue: 'April 9, 2026',
        updatedLabel: 'Last Updated',
        updatedValue: 'April 12, 2026',
        scopeLabel: 'Scope',
        scopeValue: 'Site pages, the form submission flow, and related public-facing display content'
      },
      tocLabel: 'Privacy notice contents',
      highlights: {
        submissionTitle: 'Form Handling',
        submissionBody: 'Form submissions are received by this site and then stored and organized through Google Forms / Google Sheets.',
        publicTitle: 'Public Display',
        publicBody: 'Institution exposure content may be curated and displayed on public pages of this site.',
        cookieTitle: 'Language Cookie',
        cookieBody: 'The site currently uses one first-party language-preference cookie and does not use it for advertising or cross-site tracking.'
      },
      sections: {
        summary: 'Overview',
        formSubmission: 'Form Submission And Public Display',
        thirdParty: 'Third-Party Services',
        retention: 'Retention And Removal',
        security: 'Security Measures',
        cookie: 'Cookie Currently In Use',
        manage: 'Your Choices',
        contact: 'Contact',
        publicInfo: 'Public Data'
      },
      summary: 'At the moment, this site only uses one first-party cookie to remember your language preference when you actively switch languages. We do not use this cookie for advertising, cross-site tracking, or profiling.',
      overviewItems: [
        'When you browse the site, we currently write only one language-preference cookie if you actively switch languages.',
        'When you submit the form, personal details such as birth year and sex are used mainly for internal review, verification, and statistics and are not directly shown on public pages of this site.',
        'Content related to institution exposure may appear after review on public pages, maps, or related display modules of the site.'
      ],
      formLead: 'Form submissions may contain both internally handled information and information that may later be shown publicly.',
      formItems: [
        'Internally handled information typically includes personal details such as birth year and sex for internal review, verification, and statistics.',
        'Information that may be shown publicly typically includes related experiences, institution name, region, institution address, institution contact information, principal or headmaster name, descriptions of scandals or violence, and other supplemental content.',
        'If you click a location button such as "Use current location", your browser will request location permission. The location result is only used to help fill the current address or coordinates and is sent only if you confirm and submit the form.',
        'Please do not place ID numbers, private phone numbers, home addresses, messaging account IDs, or other sensitive personal information in fields that may be made public.'
      ],
      cookieIntro: 'The cookie currently used by this site is listed below:',
      cookieFields: {
        name: 'Name',
        purpose: 'Purpose',
        trigger: 'When It Is Written',
        retention: 'Retention',
        scope: 'Scope',
        attributes: 'Attributes'
      },
      cookieValues: {
        purpose: 'Remembers the interface language you selected so you do not need to switch again on your next visit.',
        trigger: 'It is written when you use the language switcher to visit a URL with ?lang=... and the new language differs from the current setting.',
        retention: 'Up to 30 days (Max-Age=2592000).',
        scope: 'Pages under the site root path /.',
        attributes: 'SameSite=Lax.'
      },
      thirdPartyLead: 'To support form storage and certain site features, the site may use the following third-party services:',
      thirdPartyItems: [
        'Google Forms / Google Sheets: used to store and organize submitted form content.',
        'Google Cloud Translation (when enabled): some publicly displayed text may be sent to the translation service when the site translation feature is in use.',
        'Map tile providers and static asset CDNs: the map page may load public basemap tiles or frontend dependencies from those services.'
      ],
      retentionItems: [
        'The language-preference cookie is kept for up to 30 days unless you delete it earlier.',
        'Submitted form content may be retained as needed for project operations, verification, statistics, public-interest display, and follow-up handling; if you need to discuss correction or removal, please contact the maintainer through the address below.',
        'Server-side runtime logs and rate-limit records keep only the minimum metadata needed for troubleshooting and security and are not intended to store the full form body in audit logs.'
      ],
      securityItems: [
        'The form flow uses server-side validation, rate limiting, anti-abuse tokens, honeypot fields, and no-store caching rules for sensitive pages.',
        'We try to minimize unnecessary exposure in logs and public APIs and apply field-level filtering before public display.',
        'However, no internet transmission or third-party service can guarantee absolute security; please avoid submitting unnecessary sensitive personal information.'
      ],
      manageItems: [
        'You may choose not to submit the form, or submit only the information you are willing to provide.',
        'You may delete or block the language-preference cookie in your browser settings at any time; if removed, the site falls back to the default language.',
        'If you want to discuss correction, removal, or takedown of content related to you, please contact the project maintainer by email below.'
      ],
      contactBody: 'If you have questions about this privacy notice, the public-display scope of form content, or how site content is handled, you can contact the project maintainer here:'
    },
    submitSuccess: {
      badge: 'Success',
      title: 'Submission received. Thank you.',
      message: 'We have received your form. Thank you for taking part. Your contribution helps move this work forward.',
      backForm: 'Back to Form',
      backHome: 'Back to Home',
      petition: 'Anti-Conversion Institution Petition'
    },
    submitStatus: {
      title: 'Debug Submission Result',
      mode: 'Submission Mode:',
      successfulTargets: 'Successful Targets:',
      failedTargets: 'Failed Targets:',
      error: 'Error:',
      none: 'None',
      targets: {
        both: 'Google Form + D1',
        d1: 'D1 Database',
        google: 'Google Form'
      }
    },
    submitPreview: {
      badge: 'Dry Run',
      title: 'Dry Run Preview',
      intro: 'This submission has not been sent to the live submission target yet. Below is the final field set and value payload assembled locally.',
      targetUrl: 'Google Form Target URL (if enabled):',
      columns: {
        entry: 'Google Form Entry',
        field: 'Field',
        value: 'Value'
      },
      payloadEyebrow: 'Payload',
      payload: 'URL Encoded Payload',
      backForm: 'Back to Form'
    },
    submitConfirm: {
      badge: 'Review',
      title: 'Confirm Submission',
      intro: 'This step has not sent anything to the live submission target yet. Please review the content below before confirming the final submission.',
      targetUrl: 'Target URL:',
      columns: {
        entry: 'Google Form Entry',
        field: 'Field',
        value: 'Value'
      },
      confirm: 'Confirm and Submit',
      confirming: 'Submitting...',
      backForm: 'Back to Form'
    },
    submitError: {
      badge: 'Retry',
      title: 'Submission Failed',
      intro: 'The in-site submission did not complete successfully. If a prefilled Google Form fallback link is available below, you can continue there.',
      privacyNote: 'Note: the link below contains the form content you just entered, so please do not share it casually.',
      proxyNote: 'Note: if your current network cannot access Google services directly, opening the Google Form page may require a network proxy.',
      openFallback: 'Open Google Form to Continue',
      urlLabel: 'Prefilled Google Form Link',
      backForm: 'Back to Form'
    },
    maintenance: {
      badge: 'Site Maintenance',
      title: 'We are performing a short maintenance',
      description: 'We are upgrading and checking the site for a more stable experience. Pages, forms, and APIs are temporarily unavailable.',
      siteLabel: 'Site',
      modeLabel: 'Service state',
      defaultNotice: 'Maintenance mode is active',
      refresh: 'Try again'
    },
    fields: {
      birthDate: 'Date of Birth',
      birthYear: 'Birth Year',
      victimBirthYear: 'Survivor Birth Year',
      birthMonth: 'Birth Month',
      birthDay: 'Birth Day',
      age: 'Age',
      identity: 'Submission Role',
      agentRelationship: 'Relationship to the Survivor',
      sex: 'Gender',
      victimSex: 'Survivor Gender',
      sexOther: 'Other Gender Identity or Additional Notes',
      preInstitutionProvinceCode: 'Province Before Entering the Institution',
      preInstitutionCityCode: 'City Before Entering the Institution',
      provinceCode: 'Institution Province',
      cityCode: 'Institution City / District',
      countyCode: 'Institution County / District',
      parentMotivations: 'Reasons the Parent(s) Chose the Institution',
      parentMotivationOther: 'Reasons the Parent(s) Chose the Institution (Other Reason)',
      schoolName: 'Institution Name',
      schoolAddress: 'Institution Address',
      dateStart: 'First Date Sent There',
      dateEnd: 'Departure Date',
      exitMethod: 'How the Survivor Left the Institution',
      exitMethodOther: 'How the Survivor Left the Institution (Other Method)',
      experience: 'Personal Institutional Experience Description',
      headmasterName: 'Principal / Person in Charge',
      abuserInfo: 'Known Information and Description of Abusers / Drill Instructors',
      contactInformation: 'Institution Contact Information',
      violenceCategories: 'Institution Scandals and Violent Behavior',
      violenceCategoryOther: 'Institution Scandals and Violent Behavior (Other Violent Behavior)',
      scandal: 'Detailed Description of Scandals and Violent Behavior',
      legalAidStatus: 'Reporting or Legal Aid Status',
      legalAidOther: 'Reporting or Legal Aid Status (Other)',
      other: 'Additional Notes'
    },
    previewFields: {
      birthDate: 'Date of Birth',
      province: 'Institution Province',
      city: 'Institution City / District',
      schoolName: 'Institution Name',
      identity: 'Submission Role',
      sex: 'Gender',
      schoolAddress: 'Institution Address',
      experience: 'Personal Institutional Experience Description',
      headmasterName: 'Principal / Person in Charge',
      contactInformation: 'Institution Contact Information',
      scandal: 'Detailed Description of Scandals and Violent Behavior',
      other: 'Additional Notes',
      dateStart: 'First Date Sent There',
      dateEnd: 'Departure Date'
    },
    formErrors: {
      required: '{label} is required',
      maxLength: '{label} cannot exceed {maxLength} characters',
      invalidBirthDate: 'Please enter a valid {label}',
      ageRange: '{label} must be an integer between {min} and {max}',
      invalidIdentity: 'Please choose a valid submission role',
      invalidChoice: 'The selected value for {label} is invalid',
      invalidSex: 'The selected gender value is invalid',
      otherSexRequired: 'When "Other gender identity" is selected, please choose MtF / FtM / X / Queer or enter another gender identity or additional notes',
      provinceCityMismatch: 'The selected institution province and institution city / district do not match',
      preInstitutionProvinceCityMismatch: 'The selected pre-institution province and city do not match',
      cityCountyMismatch: 'The selected institution city / district and institution county / district do not match',
      invalidFormat: '{label} has an invalid format',
      endDateBeforeStart: '{endLabel} cannot be earlier than {startLabel}'
    },
    server: {
      submitFailedPrefix: 'Submission failed: ',
      submitFailed: 'Submission failed',
      invalidFormSubmission: 'This submission has expired or looks invalid. Please refresh the form and try again.',
      maintenanceActive: 'Site maintenance is in progress. Please try again later.',
      tooManyRequests: 'Too many requests. Please try again later.',
      mapDataUnavailable: 'Unable to fetch map data',
      areaOptionsUnavailable: 'Unable to load area options'
    },
    debug: {
      title: 'Debug',
      intro: 'This page is only available when DEBUG_MOD=true.',
      sections: {
        request: 'Request & Runtime',
        site: 'Site Configuration',
        integrations: 'Integration Status',
        limits: 'Limits & Form Settings',
        tools: 'Debug Tools'
      },
      labels: {
        language: 'Language',
        requestPath: 'Request Path',
        runtime: 'Runtime',
        assetVersion: 'Asset Version',
        siteTitle: 'Site Title',
        siteUrl: 'Site URL',
        apiUrl: 'API URL',
        debugMode: 'Debug Mode',
        formDryRun: 'Form Dry Run',
        formSubmitTarget: 'Form Submission Target',
        correctionSubmitTarget: 'Correction Submission Target',
        maintenanceMode: 'Maintenance Mode',
        maintenanceRetryAfter: 'Maintenance Retry-After',
        trustProxy: 'Trust Proxy',
        mapNodeTransport: 'Node Map Transport Override',
        googleForm: 'Google Form Submit URL',
        correctionGoogleForm: 'Correction Google Form',
        googleScript: 'Private Map Upstream',
        publicMapDataUrl: 'Public Map Fallback URL',
        translationProvider: 'Translation Provider',
        redisRateLimit: 'Redis Rate Limit Store',
        formProtectionSecret: 'Form Protection Secret',
        pageReadLimit: 'Page Read Limit',
        mapReadLimit: 'Map Read Limit',
        submitRateLimit: 'Submit Rate Limit',
        mapUpstreamTimeout: 'Map Upstream Timeout',
        translationTimeout: 'Translation Provider Timeout',
        minFillMs: 'Minimum Fill Time',
        maxAgeMs: 'Form Token Max Age'
      },
      values: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        configured: 'Configured',
        missing: 'Missing',
        unknown: 'Unknown',
        explicit: 'Explicit',
        derived: 'Derived',
        memoryOnly: 'Memory Only',
        publicFallbackOnly: 'Public Fallback Only',
        node: 'Node.js',
        workers: 'Cloudflare Workers',
        limitWindow: '{count} per {minutes} min',
        milliseconds: '{count} ms',
        seconds: '{count} s'
      },
      samples: {
        d1SkippedError: 'Debug simulation skipped the real D1 write.',
        form: {
          schoolName: 'Debug Preview Academy',
          schoolAddress: 'Debug Road 12, Luojiang District',
          experience: 'Debug preview sample content for layout and localization checks.',
          headmasterName: 'Debug Principal',
          contactInformation: 'debug-preview@example.com',
          scandal: 'Debug-only scandal summary placeholder.',
          other: 'Debug-only additional notes placeholder.'
        },
        correction: {
          schoolName: 'Debug Correction Academy',
          schoolAddress: 'Debug Correction Road 5, Luojiang District',
          contactInformation: 'debug-correction@example.com',
          headmasterName: 'Debug Correction Principal',
          correctionContent: 'Debug correction preview content for Google Form fallback and result-page checks.'
        }
      },
      submitTargets: {
        both: 'Google Form + D1',
        d1: 'D1 Database',
        google: 'Google Form'
      },
      links: {
        submitErrorPreview: 'Open submission error preview',
        submitPreview: 'Open submission preview',
        submitConfirm: 'Open submission confirmation',
        correctionSubmitSuccessPreview: 'Open correction success preview',
        correctionSubmitErrorPreview: 'Open correction error preview'
      }
    },
    data: {
      inputTypes: {
        self: 'Survivor',
        agent: 'Survivor Representative',
        bulk: 'Bulk Data'
      },
      provinceNames: buildLocalizedLegacyProvinceNames('en')
    }
  }
};

function resolveLanguage(language) {
  return supportedLanguages.includes(language) ? language : null;
}

function getValueByPath(source, path) {
  return path.split('.').reduce((result, segment) => {
    if (result && Object.prototype.hasOwnProperty.call(result, segment)) {
      return result[segment];
    }
    return undefined;
  }, source);
}

function interpolateString(value, variables = {}) {
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return `{${key}}`;
  });
}

function cloneAndInterpolate(value, variables = {}) {
  // 翻译节点有时是对象或数组，递归插值后可直接下发给模板和前端脚本复用。
  if (typeof value === 'string') {
    return interpolateString(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneAndInterpolate(item, variables));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneAndInterpolate(nestedValue, variables)])
    );
  }

  return value;
}

function getMessages(language) {
  return messages[resolveLanguage(language) || defaultLanguage];
}

function translate(language, key, variables = {}) {
  const activeMessages = getMessages(language);
  const fallbackMessages = getMessages(defaultLanguage);
  const rawValue = getValueByPath(activeMessages, key) ?? getValueByPath(fallbackMessages, key) ?? key;
  return cloneAndInterpolate(rawValue, variables);
}

function getLanguageOptions(language) {
  const resolvedLanguage = resolveLanguage(language) || defaultLanguage;
  return supportedLanguages.map((code) => ({
    code,
    label: translate(resolvedLanguage, `common.languages.${code}`)
  }));
}

function getProvinceCodeLabels(language) {
  return provinceCodeLabels[resolveLanguage(language) || defaultLanguage];
}

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((result, chunk) => {
      const index = chunk.indexOf('=');
      if (index === -1) {
        return result;
      }

      const key = chunk.slice(0, index).trim();
      const value = chunk.slice(index + 1).trim();
      // 这里只解析最基础的 key=value cookie，足够支撑语言切换场景。
      result[key] = decodeURIComponent(value);
      return result;
    }, {});
}

function serializeLanguageCookie(language) {
  return `lang=${encodeURIComponent(language)}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

module.exports = {
  defaultLanguage,
  getLanguageOptions,
  getMessages,
  getProvinceCodeLabels,
  parseCookieHeader,
  resolveLanguage,
  serializeLanguageCookie,
  supportedLanguages,
  translate
};
