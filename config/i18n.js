const supportedLanguages = ['zh-CN', 'zh-TW', 'en'];
const defaultLanguage = 'zh-TW';

const provinceCodeLabels = {
  'zh-CN': {
    '110000': '北京',
    '120000': '天津',
    '130000': '河北',
    '140000': '山西',
    '150000': '内蒙古',
    '210000': '辽宁',
    '220000': '吉林',
    '230000': '黑龙江',
    '310000': '上海',
    '320000': '江苏',
    '330000': '浙江',
    '340000': '安徽',
    '350000': '福建',
    '360000': '江西',
    '370000': '山东',
    '410000': '河南',
    '420000': '湖北',
    '430000': '湖南',
    '440000': '广东',
    '450000': '广西',
    '460000': '海南',
    '500000': '重庆',
    '510000': '四川',
    '520000': '贵州',
    '530000': '云南',
    '540000': '西藏',
    '610000': '陕西',
    '620000': '甘肃',
    '630000': '青海',
    '640000': '宁夏',
    '650000': '新疆',
    '710000': '台湾',
    '810000': '香港',
    '820000': '澳门'
  },
  'zh-TW': {
    '110000': '北京',
    '120000': '天津',
    '130000': '河北',
    '140000': '山西',
    '150000': '內蒙古',
    '210000': '遼寧',
    '220000': '吉林',
    '230000': '黑龍江',
    '310000': '上海',
    '320000': '江蘇',
    '330000': '浙江',
    '340000': '安徽',
    '350000': '福建',
    '360000': '江西',
    '370000': '山東',
    '410000': '河南',
    '420000': '湖北',
    '430000': '湖南',
    '440000': '廣東',
    '450000': '廣西',
    '460000': '海南',
    '500000': '重慶',
    '510000': '四川',
    '520000': '貴州',
    '530000': '雲南',
    '540000': '西藏',
    '610000': '陝西',
    '620000': '甘肅',
    '630000': '青海',
    '640000': '寧夏',
    '650000': '新疆',
    '710000': '臺灣',
    '810000': '香港',
    '820000': '澳門'
  },
  en: {
    '110000': 'Beijing',
    '120000': 'Tianjin',
    '130000': 'Hebei',
    '140000': 'Shanxi',
    '150000': 'Inner Mongolia',
    '210000': 'Liaoning',
    '220000': 'Jilin',
    '230000': 'Heilongjiang',
    '310000': 'Shanghai',
    '320000': 'Jiangsu',
    '330000': 'Zhejiang',
    '340000': 'Anhui',
    '350000': 'Fujian',
    '360000': 'Jiangxi',
    '370000': 'Shandong',
    '410000': 'Henan',
    '420000': 'Hubei',
    '430000': 'Hunan',
    '440000': 'Guangdong',
    '450000': 'Guangxi',
    '460000': 'Hainan',
    '500000': 'Chongqing',
    '510000': 'Sichuan',
    '520000': 'Guizhou',
    '530000': 'Yunnan',
    '540000': 'Tibet',
    '610000': 'Shaanxi',
    '620000': 'Gansu',
    '630000': 'Qinghai',
    '640000': 'Ningxia',
    '650000': 'Xinjiang',
    '710000': 'Taiwan',
    '810000': 'Hong Kong',
    '820000': 'Macau'
  }
};

const legacyProvinceNamesByCode = {
  '110000': '北京',
  '120000': '天津',
  '130000': '河北',
  '140000': '山西',
  '150000': '內蒙古',
  '210000': '遼寧',
  '220000': '吉林',
  '230000': '黑龍江',
  '310000': '上海',
  '320000': '江蘇',
  '330000': '浙江',
  '340000': '安徽',
  '350000': '福建',
  '360000': '江西',
  '370000': '山東',
  '410000': '河南',
  '420000': '湖北',
  '430000': '湖南',
  '440000': '廣東',
  '450000': '廣西',
  '460000': '海南',
  '500000': '重慶',
  '510000': '四川',
  '520000': '貴州',
  '530000': '雲南',
  '540000': '西藏',
  '610000': '陝西',
  '620000': '甘肅',
  '630000': '青海',
  '640000': '寧夏',
  '650000': '新疆',
  '710000': '臺灣',
  '810000': '香港',
  '820000': '澳門'
};

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
      languages: {
        'zh-CN': '简中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 NO CONVERSION THERAPY Project. By:',
      loading: '加载中...'
    },
    pageTitles: {
      home: '首页|{title}',
      form: '填写表单|{title}',
      map: '地图|{title}',
      about: '关于我们|{title}',
      submitPreview: '提交预览|{title}',
      blog: '文库|{title}',
      article: '{articleTitle}|{title}'
    },
    navigation: {
      home: '返回首页',
      about: '关于我们',
      allArticles: '所有文章'
    },
    index: {
      tagline: '每一份真实的声音，都是终结扭转与伤害的力量。',
      fillForm: '参与填表',
      viewMap: '查看扭转机构综合地图',
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
      articleNotFound: '文章不存在'
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: '记录黑暗，是为了迎接光明',
      sections: {
        basic: '基础信息',
        experience: '你的经历',
        exposure: '曝光信息'
      },
      fields: {
        identity: '请问您是作为什么身份来填写本表单？',
        age: '年龄',
        sex: '性别',
        province: '省份',
        city: '城市 / 区县',
        county: '县区（可选）',
        schoolName: '学校名称',
        schoolAddress: '学校地址',
        dateStart: '入学日期',
        dateEnd: '离开日期',
        experience: '经历描述',
        headmasterName: '负责人/校长姓名',
        contactInformation: '学校联系方式',
        scandal: '已知丑闻',
        other: '其他补充'
      },
      identityOptions: {
        self: '受害者本人',
        agent: '受害者的代理人'
      },
      sexOptions: {
        placeholder: '请选择',
        male: '男',
        female: '女',
        mtf: 'MtF',
        ftm: 'FtM',
        other: '其他'
      },
      placeholders: {
        age: '请输入年龄',
        otherSex: '请注明您的性别',
        province: '选择省份',
        city: '请先选择省份',
        countyInitial: '可选：请先选择城市 / 区县',
        county: '可选：选择县区',
        countyUnavailable: '可选：当前城市无县区可选',
        schoolName: '请填写完整名称',
        schoolAddress: '若已知，请详细填写',
        experience: '请描述您在该校的日常生活、管理方式等...',
        headmasterName: '姓名',
        contactInformation: '电话、邮箱或地址',
        scandal: '如体罚、非法拘禁、虚假宣传等内容...',
        other: '任何您想补充的信息'
      },
      buttons: {
        openMap: '点击可直接在地图上选点',
        submit: '确认并提交信息'
      },
      hints: {
        dateEnd: '若目前仍在校，可不填',
        selectedPoint: '选取点: {lat}, {lng}'
      },
      validation: {
        selectIdentity: '请选择填写身份',
        fillAge: '请填写年龄',
        ageRange: '年龄必须是 {min} 到 {max} 的整数',
        selectSex: '请选择性别',
        selectProvince: '请选择省份',
        selectCity: '请选择城市 / 区县',
        fillSchoolName: '请填写学校名称',
        fillDateStart: '请填写入学日期',
        fillContactInformation: '请填写学校联系方式',
        specifyOtherSex: '请注明您的性别',
        endDateBeforeStart: '离开日期不能早于入学日期'
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
        averageAge: '受害者平均年龄：',
        secondsAgo: '{seconds} 秒前',
        refresh: '刷新',
        ageValue: '{age} 岁'
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
        fields: {
          scandal: '学校丑闻：',
          experience: '受害者经历：',
          other: '其他：',
          headmaster: '负责人：',
          province: '省份：',
          region: '城市 / 区县：',
          address: '地址：',
          contact: '联系方式：'
        },
        viewDetails: '查看详细信息'
      },
      api: {
        summary: '想要调用 API？',
        privacy: '我们明确表示：我们永远不会泄露受访者的任何敏感性资料。',
        beforeUse: '在调用 API 之前，我们要明白：HosinoNeko 站长只允许公开当前在地图上展示的资料。',
        implementationTitle: '我们如何实现的？',
        implementationBody: '首先你的表单会透过 Vercel 上传到 Google Forms，在那里生成一个电子表格。站长在其表格的 Apps Script 中部署了应用程序，会将地址一栏转化为经纬度并保存在表格中。然后 Google 侧会生成一个原始 JSON API。因为那个 API 包含全部资讯，所以不会公开。本站再从中取出需要的讯息，生成当前对外开放的 API。',
        opinionTitle: '我们的看法：',
        opinionBody: '我们很希望你们使用这个 API 并接入到你们的网站上。即使网站被封禁，资料仍然可以透过 API 在不同网络中继续传播。这也是一种去中心化。',
        cta: '知道了这些，你就可以使用我们的 API 了。欢迎把它接入到你们的网站。',
        link: '获取 API 数据源'
      }
    },
    about: {
      title: '关于我们',
      friendLinks: '友情链接',
      ownership: '本项目隶属于 TRANS UNION 团队，拥有其所有知识产权。',
      origin: '本网站建站于 2026 年 2 月 21 日，由 HosinoNeko 站长在逃到上海不久后建立，而规划和设想早在站长仍被困于扭转机构时便已出现。',
      thanks: '在这里衷心感谢以下项目、企业和个人为本项目提供了免费的援助，没有他们就没有这个网站的诞生：',
      friendDescriptions: {
        hosinoneko: '一只可爱的小药娘的网站',
        muyuan: '一名独立调查人',
        amber: ''
      },
      supporters: {
        hosino: '网站开发',
        muyuan: '社群传播',
        leaflet: '地图',
        amber: '社群建立',
        nanmuxue: '网站开发',
        google: '表单与 Apps Script',
        github: '平台',
        vercel: '网站服务',
        nodejs: '框架'
      }
    },
    submitSuccess: {
      title: '提交成功！感谢你的参与。',
      message: '我们已经收到了你的表单，感谢你的参与。你的参与将是我们前进的动力！',
      backHome: '返回首页',
      petition: '抵制扭转机构签名会'
    },
    submitPreview: {
      title: '表单 Dry Run 预览',
      intro: '这次提交没有发送到 Google Form。下面是本次本地组装出的最终字段和值。',
      targetUrl: '目标网址：',
      columns: {
        entry: 'Google Form Entry',
        field: '字段',
        value: '值'
      },
      payload: 'URL Encoded Payload',
      backForm: '返回表单'
    },
    fields: {
      age: '年龄',
      identity: '填写身份',
      sex: '性别',
      sexOther: '其他性别说明',
      provinceCode: '省份',
      cityCode: '城市 / 区县',
      countyCode: '县区',
      schoolName: '学校名称',
      schoolAddress: '学校地址',
      dateStart: '入学日期',
      dateEnd: '离开日期',
      experience: '经历描述',
      headmasterName: '负责人/校长姓名',
      contactInformation: '学校联系方式',
      scandal: '已知丑闻',
      other: '其他补充'
    },
    previewFields: {
      age: '年龄',
      province: '省份',
      city: '区、县 / 城市',
      schoolName: '学校名称',
      identity: '填写身份',
      sex: '性别',
      schoolAddress: '学校地址',
      experience: '经历描述',
      headmasterName: '负责人/校长姓名',
      contactInformation: '学校联系方式',
      scandal: '已知丑闻',
      other: '其他补充',
      dateStart: '入学日期',
      dateEnd: '离开日期'
    },
    formErrors: {
      required: '{label}为必填',
      maxLength: '{label}不能超过 {maxLength} 字',
      ageRange: '{label}必须是 {min} 到 {max} 的整数',
      invalidIdentity: '请选择有效的填写身份',
      invalidSex: '性别不合法，请修改',
      otherSexRequired: '选择其他性别时，请填写说明',
      provinceCityMismatch: '省份和城市 / 区县不匹配',
      cityCountyMismatch: '城市 / 区县和县区不匹配',
      invalidFormat: '{label}格式不正确',
      endDateBeforeStart: '{endLabel}不能早于{startLabel}'
    },
    server: {
      submitFailedPrefix: '提交失败：',
      submitFailed: '提交失败',
      tooManyRequests: '提交过于频繁，请稍后再试。',
      mapDataUnavailable: '无法取得地图数据'
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
      languages: {
        'zh-CN': '簡中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 NO CONVERSION THERAPY Project. By:',
      loading: '載入中...'
    },
    pageTitles: {
      home: '主頁|{title}',
      form: '填寫表單|{title}',
      map: '地圖|{title}',
      about: '關於我們|{title}',
      submitPreview: '提交預覽|{title}',
      blog: '文庫|{title}',
      article: '{articleTitle}|{title}'
    },
    navigation: {
      home: '返回首頁',
      about: '關於我們',
      allArticles: '所有文章'
    },
    index: {
      tagline: '每一份真實的聲音，都是終結扭轉與傷害的力量。',
      fillForm: '參與填表',
      viewMap: '查看扭轉機構綜合地圖',
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
      articleNotFound: '文章不存在'
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: '記錄黑暗，是為了迎接光明',
      sections: {
        basic: '基礎資訊',
        experience: '您的經歷',
        exposure: '曝光資訊'
      },
      fields: {
        identity: '請問您是作爲什麽身份來填寫本表單？',
        age: '年齡',
        sex: '性別',
        province: '省份',
        city: '城市 / 區縣',
        county: '縣區（可選）',
        schoolName: '學校名稱',
        schoolAddress: '學校地址',
        dateStart: '入學日期',
        dateEnd: '離開日期',
        experience: '經歷描述',
        headmasterName: '負責人/校長姓名',
        contactInformation: '學校聯繫方式',
        scandal: '已知醜聞',
        other: '其他補充'
      },
      identityOptions: {
        self: '受害者本人',
        agent: '受害者的代理人'
      },
      sexOptions: {
        placeholder: '請選擇',
        male: '男',
        female: '女',
        mtf: 'MtF',
        ftm: 'FtM',
        other: '其他'
      },
      placeholders: {
        age: '請輸入年齡',
        otherSex: '請註明您的性別',
        province: '選擇省份',
        city: '請先選擇省份',
        countyInitial: '可選：請先選擇城市 / 區縣',
        county: '可選：選擇縣區',
        countyUnavailable: '可選：當前城市無縣區可選',
        schoolName: '請填寫完整名稱',
        schoolAddress: '若已知，請詳細填寫',
        experience: '請描述您在該校的日常生活、管理方式等...',
        headmasterName: '姓名',
        contactInformation: '電話、郵箱或地址',
        scandal: '如體罰、非法拘禁、虛假宣傳等內容...',
        other: '任何您想補充的信息'
      },
      buttons: {
        openMap: '點擊可直接在地圖上選點',
        submit: '確認並提交信息'
      },
      hints: {
        dateEnd: '若目前仍在校，可不填',
        selectedPoint: '選取點: {lat}, {lng}'
      },
      validation: {
        selectIdentity: '請選擇填寫身份',
        fillAge: '請填寫年齡',
        ageRange: '年齡必須是 {min} 到 {max} 的整數',
        selectSex: '請選擇性別',
        selectProvince: '請選擇省份',
        selectCity: '請選擇城市 / 區縣',
        fillSchoolName: '請填寫學校名稱',
        fillDateStart: '請填寫入學日期',
        fillContactInformation: '請填寫學校聯繫方式',
        specifyOtherSex: '請註明您的性別',
        endDateBeforeStart: '離開日期不能早於入學日期'
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
        averageAge: '受害者平均年齡：',
        secondsAgo: '{seconds} 秒前',
        refresh: '刷新',
        ageValue: '{age} 歲'
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
        viewDetails: '查看詳細信息'
      },
      api: {
        summary: '想要調用 API？',
        privacy: '我們明確表示：我們永遠不會洩露受訪者的任何敏感性資料。',
        beforeUse: '在調用 API 之前，我們要明白：HosinoNeko 站長只允許公開當前在地圖上展示的資料。',
        implementationTitle: '我們如何實現的？',
        implementationBody: '首先你的表單會透過 Vercel 上傳到 Google Forms，在那裡生成一個電子表格。站長在其表格的 Apps Script 中部署了應用程式，會將地址一欄轉化為經緯度並保存在表格中。然後 Google 側會生成一個原始 JSON API。因為那個 API 包含全部資訊，所以不會公開。本站再從中取出需要的訊息，生成當前對外開放的 API。',
        opinionTitle: '我們的看法：',
        opinionBody: '我們很希望你們使用這個 API 並接入到你們的網站上。即使網站被封禁，資料仍然可以透過 API 在不同網絡中繼續傳播。這也是一種去中心化。',
        cta: '知道了這些，你就可以使用我們的 API 了。歡迎把它接入到你們的網站。',
        link: '獲取 API 數據源'
      }
    },
    about: {
      title: '關於我們',
      friendLinks: '友情鏈接',
      ownership: '本項目隸屬於 TRANS UNION 團隊，擁有其所有知識產權。',
      origin: '本網站建站於 2026 年 2 月 21 日，由 HosinoNeko 站長在逃到上海不久後建立，而規劃和設想早在站長仍被困於扭轉機構時便已出現。',
      thanks: '在這裡衷心感謝以下項目、企業和個人為本項目提供了免費的援助，沒有他們就沒有這個網站的誕生：',
      friendDescriptions: {
        hosinoneko: '一隻可愛的小藥娘的網站',
        muyuan: '一名獨立調查人',
        amber: ''
      },
      supporters: {
        hosino: '網站開發',
        muyuan: '社群傳播',
        leaflet: '地圖',
        amber: '社群建立',
        nanmuxue: '網站開發',
        google: '表單與 Apps Script',
        github: '平臺',
        vercel: '網站服務',
        nodejs: '框架'
      }
    },
    submitSuccess: {
      title: '提交成功！感謝您的參與。',
      message: '我們已經收到了您的表單，感謝您的參與。您的參與將是我們前進的動力！',
      backHome: '返回首頁',
      petition: '抵制扭轉機構簽名會'
    },
    submitPreview: {
      title: '表單乾跑預覽',
      intro: '這次提交沒有發送到 Google Form。下面是本次本地組裝出的最終欄位和值。',
      targetUrl: '目標網址：',
      columns: {
        entry: 'Google Form Entry',
        field: '欄位',
        value: '值'
      },
      payload: 'URL Encoded Payload',
      backForm: '返回表單'
    },
    fields: {
      age: '年齡',
      identity: '填寫身份',
      sex: '性別',
      sexOther: '其他性別說明',
      provinceCode: '省份',
      cityCode: '城市 / 區縣',
      countyCode: '縣區',
      schoolName: '學校名稱',
      schoolAddress: '學校地址',
      dateStart: '入學日期',
      dateEnd: '離開日期',
      experience: '經歷描述',
      headmasterName: '負責人/校長姓名',
      contactInformation: '學校聯繫方式',
      scandal: '已知醜聞',
      other: '其他補充'
    },
    previewFields: {
      age: '年齡',
      province: '省份',
      city: '區、縣 / 城市',
      schoolName: '學校名稱',
      identity: '填寫身份',
      sex: '性別',
      schoolAddress: '學校地址',
      experience: '經歷描述',
      headmasterName: '負責人/校長姓名',
      contactInformation: '學校聯繫方式',
      scandal: '已知醜聞',
      other: '其他補充',
      dateStart: '入學日期',
      dateEnd: '離開日期'
    },
    formErrors: {
      required: '{label}為必填',
      maxLength: '{label}不能超過 {maxLength} 字',
      ageRange: '{label}必須是 {min} 到 {max} 的整數',
      invalidIdentity: '請選擇有效的填寫身份',
      invalidSex: '性別不合法，請修改',
      otherSexRequired: '選擇其他性別時，請填寫說明',
      provinceCityMismatch: '省份和城市 / 區縣不匹配',
      cityCountyMismatch: '城市 / 區縣和縣區不匹配',
      invalidFormat: '{label}格式不正確',
      endDateBeforeStart: '{endLabel}不能早於{startLabel}'
    },
    server: {
      submitFailedPrefix: '提交失敗：',
      submitFailed: '提交失敗',
      tooManyRequests: '提交過於頻繁，請稍後再試。',
      mapDataUnavailable: '無法取得地圖數據'
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
      languages: {
        'zh-CN': '简中',
        'zh-TW': '繁中',
        en: 'English'
      },
      footerBy: '© 2026 NO CONVERSION THERAPY Project. By:',
      loading: 'Loading...'
    },
    pageTitles: {
      home: 'Home | {title}',
      form: 'Form | {title}',
      map: 'Map | {title}',
      about: 'About | {title}',
      submitPreview: 'Submission Preview | {title}',
      blog: 'Library | {title}',
      article: '{articleTitle} | {title}'
    },
    navigation: {
      home: 'Back to Home',
      about: 'About Us',
      allArticles: 'All Articles'
    },
    index: {
      tagline: 'Every truthful voice helps bring conversion practices and abuse to an end.',
      fillForm: 'Fill Out the Form',
      viewMap: 'View the Conversion Institution Map',
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
      articleNotFound: 'Article not found'
    },
    form: {
      title: 'NO CONVERSION THERAPY FORM',
      subtitle: 'We document the darkness in order to welcome the light.',
      sections: {
        basic: 'Basic Information',
        experience: 'Your Experience',
        exposure: 'Exposure Information'
      },
      fields: {
        identity: 'What is your relationship to this submission?',
        age: 'Age',
        sex: 'Gender',
        province: 'Province',
        city: 'City / District',
        county: 'County / District (Optional)',
        schoolName: 'School Name',
        schoolAddress: 'School Address',
        dateStart: 'Enrollment Date',
        dateEnd: 'Departure Date',
        experience: 'Experience Description',
        headmasterName: 'Principal / Person in Charge',
        contactInformation: 'School Contact Information',
        scandal: 'Known Scandals',
        other: 'Other Notes'
      },
      identityOptions: {
        self: 'The survivor themself',
        agent: 'A representative of the survivor'
      },
      sexOptions: {
        placeholder: 'Please select',
        male: 'Male',
        female: 'Female',
        mtf: 'MtF',
        ftm: 'FtM',
        other: 'Other'
      },
      placeholders: {
        age: 'Enter age',
        otherSex: 'Please specify your gender',
        province: 'Select a province',
        city: 'Select a province first',
        countyInitial: 'Optional: select a city / district first',
        county: 'Optional: select a county / district',
        countyUnavailable: 'Optional: no county / district available for this city',
        schoolName: 'Please enter the full name',
        schoolAddress: 'If known, please provide as much detail as possible',
        experience: 'Describe your daily life at the institution, its management style, and other details...',
        headmasterName: 'Name',
        contactInformation: 'Phone, email, or address',
        scandal: 'For example: corporal punishment, unlawful detention, deceptive promotion...',
        other: 'Anything else you would like to add'
      },
      buttons: {
        openMap: 'Pick a point directly on the map',
        submit: 'Confirm and Submit'
      },
      hints: {
        dateEnd: 'Leave blank if you are still enrolled',
        selectedPoint: 'Selected point: {lat}, {lng}'
      },
      validation: {
        selectIdentity: 'Please choose your submission role',
        fillAge: 'Please enter age',
        ageRange: 'Age must be an integer between {min} and {max}',
        selectSex: 'Please choose gender',
        selectProvince: 'Please choose a province',
        selectCity: 'Please choose a city / district',
        fillSchoolName: 'Please enter the school name',
        fillDateStart: 'Please enter the enrollment date',
        fillContactInformation: 'Please enter the school contact information',
        specifyOtherSex: 'Please specify your gender',
        endDateBeforeStart: 'Departure date cannot be earlier than enrollment date'
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
        averageAge: 'Average age of survivors:',
        secondsAgo: '{seconds} seconds ago',
        refresh: 'Refresh',
        ageValue: '{age} years old'
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
        fields: {
          scandal: 'School scandals:',
          experience: 'Survivor experience:',
          other: 'Other:',
          headmaster: 'Principal:',
          province: 'Province:',
          region: 'City / District:',
          address: 'Address:',
          contact: 'Contact:'
        },
        viewDetails: 'View details'
      },
      api: {
        summary: 'Want to use the API?',
        privacy: 'We make this clear: we will never disclose any sensitive information about respondents.',
        beforeUse: 'Before using the API, please note that HosinoNeko only allows access to the data currently shown on the public map.',
        implementationTitle: 'How does it work?',
        implementationBody: 'First, your submission is sent through Vercel to Google Forms, where it is stored in a spreadsheet. An Apps Script attached to that spreadsheet converts addresses into latitude and longitude and stores the coordinates. Google then exposes a raw JSON API. Because that raw API contains all information, it is kept private. This site extracts only the required fields and exposes the public API you can use.',
        opinionTitle: 'Why we want this used:',
        opinionBody: 'We genuinely hope you will use this API and integrate it into your own websites. Even if the main site is blocked, the data can continue to circulate through the API. That is one form of decentralization.',
        cta: 'Now that you know how it works, feel free to use the API and integrate it into your site.',
        link: 'Get the API data source'
      }
    },
    about: {
      title: 'About Us',
      friendLinks: 'Friends & Links',
      ownership: 'This project belongs to the TRANS UNION team, which holds all related intellectual property rights.',
      origin: 'This website went online on February 21, 2026. HosinoNeko created it shortly after reaching Shanghai, but the broader plan was conceived much earlier while still trapped inside a conversion institution.',
      thanks: 'We sincerely thank the following projects, organizations, and individuals for helping make this website possible:',
      friendDescriptions: {
        hosinoneko: 'The personal site of a very cute trans girl',
        muyuan: 'An independent investigator',
        amber: ''
      },
      supporters: {
        hosino: 'Website development',
        muyuan: 'Community outreach',
        leaflet: 'Mapping',
        amber: 'Community building',
        nanmuxue: 'Website development',
        google: 'Forms and Apps Script',
        github: 'Platform',
        vercel: 'Hosting',
        nodejs: 'Framework'
      }
    },
    submitSuccess: {
      title: 'Submission received. Thank you.',
      message: 'We have received your form. Thank you for taking part. Your contribution helps move this work forward.',
      backHome: 'Back to Home',
      petition: 'Anti-Conversion Institution Petition'
    },
    submitPreview: {
      title: 'Dry Run Preview',
      intro: 'This submission was not sent to Google Form. Below is the final field set and value payload assembled locally.',
      targetUrl: 'Target URL:',
      columns: {
        entry: 'Google Form Entry',
        field: 'Field',
        value: 'Value'
      },
      payload: 'URL Encoded Payload',
      backForm: 'Back to Form'
    },
    fields: {
      age: 'Age',
      identity: 'Submission Role',
      sex: 'Gender',
      sexOther: 'Other Gender Description',
      provinceCode: 'Province',
      cityCode: 'City / District',
      countyCode: 'County / District',
      schoolName: 'School Name',
      schoolAddress: 'School Address',
      dateStart: 'Enrollment Date',
      dateEnd: 'Departure Date',
      experience: 'Experience Description',
      headmasterName: 'Principal / Person in Charge',
      contactInformation: 'School Contact Information',
      scandal: 'Known Scandals',
      other: 'Other Notes'
    },
    previewFields: {
      age: 'Age',
      province: 'Province',
      city: 'District / City',
      schoolName: 'School Name',
      identity: 'Submission Role',
      sex: 'Gender',
      schoolAddress: 'School Address',
      experience: 'Experience Description',
      headmasterName: 'Principal / Person in Charge',
      contactInformation: 'School Contact Information',
      scandal: 'Known Scandals',
      other: 'Other Notes',
      dateStart: 'Enrollment Date',
      dateEnd: 'Departure Date'
    },
    formErrors: {
      required: '{label} is required',
      maxLength: '{label} cannot exceed {maxLength} characters',
      ageRange: '{label} must be an integer between {min} and {max}',
      invalidIdentity: 'Please choose a valid submission role',
      invalidSex: 'The selected gender value is invalid',
      otherSexRequired: 'Please describe the selected "Other" gender option',
      provinceCityMismatch: 'The selected province and city / district do not match',
      cityCountyMismatch: 'The selected city / district and county / district do not match',
      invalidFormat: '{label} has an invalid format',
      endDateBeforeStart: '{endLabel} cannot be earlier than {startLabel}'
    },
    server: {
      submitFailedPrefix: 'Submission failed: ',
      submitFailed: 'Submission failed',
      tooManyRequests: 'Too many submissions. Please try again later.',
      mapDataUnavailable: 'Unable to fetch map data'
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
      result[key] = decodeURIComponent(value);
      return result;
    }, {});
}

function serializeLanguageCookie(language) {
  return `lang=${encodeURIComponent(language)}; Path=/; Max-Age=31536000; SameSite=Lax`;
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
