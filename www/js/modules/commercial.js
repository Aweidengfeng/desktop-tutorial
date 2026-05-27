const COMMERCIAL_PEAKS = [
  { id: 1, name: '珠穆朗玛峰', nameEn: 'Everest', altitude: 8849, country: '中国/尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['Alpine Ascents', 'IMG', 'Seven Summit Treks', 'Adventure Consultants', 'Furtenbach Adventures', 'Himex', 'Madison Mountaineering'], routes: '东南山脊(南坡)/东北山脊(北坡)', oxygen: true, annualClimbers: 800, annualTeams: 35, isEstimated: true, campKey: '珠穆朗玛峰' },
  { id: 2, name: '乔戈里峰', nameEn: 'K2', altitude: 8611, country: '巴基斯坦/中国', region: '喀喇昆仑', difficulty: '8000m级', season: '夏季(6-8月)', operators: ['Alpine Ascents', 'Nazir Sabir Expeditions', 'Pakistan Alpine Club', 'Latok Alpine'], routes: 'Abruzzi山脊路线', oxygen: false, annualClimbers: 150, annualTeams: 12, isEstimated: true, campKey: 'K2' },
  { id: 3, name: '干城章嘉峰', nameEn: 'Kangchenjunga', altitude: 8586, country: '印度/尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['Seven Summit Treks', 'Imagine Nepal', 'Pioneer Adventure'], routes: '西南壁路线', oxygen: true, annualClimbers: 80, annualTeams: 6, isEstimated: true, campKey: '干城章嘉峰' },
  { id: 4, name: '洛子峰', nameEn: 'Lhotse', altitude: 8516, country: '中国/尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['IMG', 'Seven Summit Treks', 'Alpine Ascents', 'Himex'], routes: '西壁/Couloir路线', oxygen: true, annualClimbers: 200, annualTeams: 15, isEstimated: true, campKey: '洛子峰' },
  { id: 5, name: '马卡鲁峰', nameEn: 'Makalu', altitude: 8485, country: '中国/尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['Seven Summit Treks', 'Imagine Nepal', 'Altitude Junkies'], routes: '北坡/西北山脊', oxygen: true, annualClimbers: 70, annualTeams: 5, isEstimated: true, campKey: '马卡鲁峰' },
  { id: 6, name: '卓奥友峰', nameEn: 'Cho Oyu', altitude: 8201, country: '中国/尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '秋季(9-10月)', operators: ['IMG', 'Asian Trekking', 'Furtenbach Adventures', 'Seven Summit Treks', 'Amical Alpin'], routes: '西北山脊路线', oxygen: false, annualClimbers: 300, annualTeams: 25, isEstimated: true, campKey: '卓奥友峰' },
  { id: 7, name: '道拉吉里峰', nameEn: 'Dhaulagiri', altitude: 8167, country: '尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['Seven Summit Treks', 'Imagine Nepal', 'Alpine Ascents', 'Altitude Junkies'], routes: '东北山脊路线', oxygen: false, annualClimbers: 90, annualTeams: 7, isEstimated: true, campKey: '道拉吉里峰' },
  { id: 8, name: '马纳斯卢峰', nameEn: 'Manaslu', altitude: 8163, country: '尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '秋季(9-10月)', operators: ['Seven Summit Treks', 'IMG', 'Furtenbach Adventures', 'Amical Alpin', 'Asian Trekking'], routes: '东北面/东北山脊', oxygen: false, annualClimbers: 400, annualTeams: 30, isEstimated: true, campKey: '马纳斯卢峰' },
  { id: 9, name: '南迦帕尔巴特峰', nameEn: 'Nanga Parbat', altitude: 8126, country: '巴基斯坦', region: '喜马拉雅', difficulty: '8000m级', season: '夏季(6-8月)', operators: ['Nazir Sabir Expeditions', 'Jasmine Tours', 'Latok Alpine'], routes: 'Kinshofer路线/鲁帕尔壁', oxygen: false, annualClimbers: 60, annualTeams: 5, isEstimated: true, campKey: '南迦帕尔巴特峰' },
  { id: 10, name: '安纳普尔纳峰', nameEn: 'Annapurna', altitude: 8091, country: '尼泊尔', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)', operators: ['Seven Summit Treks', 'Imagine Nepal', 'Altitude Junkies'], routes: '北壁路线', oxygen: false, annualClimbers: 60, annualTeams: 5, isEstimated: true, campKey: '安纳普尔纳峰' },
  { id: 11, name: '迦舒布鲁姆I峰', nameEn: 'Gasherbrum I', altitude: 8080, country: '巴基斯坦/中国', region: '喀喇昆仑', difficulty: '8000m级', season: '夏季(6-8月)', operators: ['Nazir Sabir Expeditions', 'Alpine Ascents', 'Latok Alpine'], routes: '美国路线/西北壁', oxygen: false, annualClimbers: 50, annualTeams: 4, isEstimated: true, campKey: '加舒尔布鲁姆I峰' },
  { id: 12, name: '布洛阿特峰', nameEn: 'Broad Peak', altitude: 8051, country: '巴基斯坦/中国', region: '喀喇昆仑', difficulty: '8000m级', season: '夏季(6-8月)', operators: ['Nazir Sabir Expeditions', 'Alpine Ascents', 'Latok Alpine'], routes: '普通路线/西壁', oxygen: false, annualClimbers: 120, annualTeams: 10, isEstimated: true, campKey: '布洛阿特峰' },
  { id: 13, name: '迦舒布鲁姆II峰', nameEn: 'Gasherbrum II', altitude: 8034, country: '巴基斯坦/中国', region: '喀喇昆仑', difficulty: '8000m级', season: '夏季(6-8月)', operators: ['Nazir Sabir Expeditions', 'Alpine Ascents', 'IMG', 'Furtenbach Adventures'], routes: '西南壁路线', oxygen: false, annualClimbers: 180, annualTeams: 14, isEstimated: true, campKey: '加舒尔布鲁姆II峰' },
  { id: 14, name: '希夏邦马峰', nameEn: 'Shishapangma', altitude: 8027, country: '中国', region: '喜马拉雅', difficulty: '8000m级', season: '春季(4-5月)/秋季(9-10月)', operators: ['IMG', 'Seven Summit Treks', 'Furtenbach Adventures', 'Amical Alpin'], routes: '北坡/西南壁', oxygen: false, annualClimbers: 150, annualTeams: 12, isEstimated: true, campKey: '希夏邦马峰' },
  { id: 15, name: '慕士塔格峰', nameEn: 'Muztagh Ata', altitude: 7546, country: '中国', region: '帕米尔', difficulty: '进阶7000m', season: '夏季(7-8月)', operators: ['China Mountaineering Association', 'Alpenglow Expeditions', 'SummitClimb'], routes: '东坡标准路线', oxygen: false, annualClimbers: 200, annualTeams: 18, isEstimated: true, campKey: '慕士塔格峰' },
  { id: 16, name: '列宁峰', nameEn: 'Lenin Peak', altitude: 7134, country: '吉尔吉斯斯坦/塔吉克斯坦', region: '帕米尔', difficulty: '进阶7000m', season: '夏季(7-8月)', operators: ['Alpenglow Expeditions', 'SummitClimb', 'Vertical', 'Asia Mountains'], routes: '标准路线(Razdelnaya山脊)', oxygen: false, annualClimbers: 300, annualTeams: 25, isEstimated: true, campKey: '列宁峰' },
  { id: 17, name: '阿玛达布拉姆峰', nameEn: 'Ama Dablam', altitude: 6812, country: '尼泊尔', region: '喜马拉雅', difficulty: '技术型', season: '秋季(10-11月)/春季(3-5月)', operators: ['Alpine Ascents', 'IMG', 'Seven Summit Treks', 'Adventure Consultants', 'Peak Freaks'], routes: '西南山脊路线', oxygen: false, annualClimbers: 350, annualTeams: 30, isEstimated: true, campKey: '阿玛达布拉姆峰' },
  { id: 18, name: '阿空加瓜峰', nameEn: 'Aconcagua', altitude: 6961, country: '阿根廷', region: '安第斯', difficulty: '进阶7000m', season: '南半球夏季(12-2月)', operators: ['IMG', 'Alpine Ascents', 'RMI Expeditions', 'SummitClimb', 'Aymara Expeditions'], routes: '标准路线(普通路线)/波兰冰川', oxygen: false, annualClimbers: 3000, annualTeams: 120, isEstimated: false, campKey: '阿空加瓜峰' },
  { id: 19, name: 'Denali', nameEn: 'Denali', altitude: 6190, country: '美国', region: '北美', difficulty: '进阶7000m', season: '春季(5-6月)', operators: ['RMI Expeditions', 'Alpine Ascents', 'AAI', 'Mountain Trip', 'Rainier Mountaineering'], routes: '西山脊/卡希尔顿路线', oxygen: false, annualClimbers: 1200, annualTeams: 80, isEstimated: false, campKey: '麦金利山' },
  { id: 20, name: '乞力马扎罗山', nameEn: 'Kilimanjaro', altitude: 5895, country: '坦桑尼亚', region: '非洲', difficulty: '入门6000m', season: '旱季(1-3月/6-10月)', operators: ['Zara Tours', 'Thomson Safaris', 'Altezza Travel', 'Kilimanjaro Experts', 'Africa Dream Safaris'], routes: 'Marangu路线/Machame路线/Lemosho路线', oxygen: false, annualClimbers: 35000, annualTeams: 2000, isEstimated: false, campKey: '乞力马扎罗山' },
  { id: 21, name: '厄尔布鲁士山', nameEn: 'Elbrus', altitude: 5642, country: '俄罗斯', region: '高加索', difficulty: '入门6000m', season: '夏季(6-8月)', operators: ['Alpine Ascents', 'IMG', 'Alpenglow Expeditions', 'MCS AlpClub', 'Risk.ru'], routes: '南坡标准路线/北坡路线', oxygen: false, annualClimbers: 15000, annualTeams: 800, isEstimated: true, campKey: '厄尔布鲁士山' },
  { id: 22, name: '文森峰', nameEn: 'Vinson Massif', altitude: 4892, country: '南极洲', region: '南极', difficulty: '入门6000m', season: '南极夏季(11-1月)', operators: ['Alpine Ascents', 'Antarctic Logistics & Expeditions', 'IMG', 'Climbing the Seven Summits'], routes: '标准路线', oxygen: false, annualClimbers: 200, annualTeams: 20, isEstimated: true, campKey: '文森峰' },
  { id: 23, name: '卡斯滕士金字塔', nameEn: 'Carstensz Pyramid', altitude: 4884, country: '印度尼西亚', region: '大洋洲', difficulty: '技术型', season: '全年(需申请许可)', operators: ['Alpine Ascents', 'Adventure Indonesia', 'Papua Jungle Expedition'], routes: '标准技术路线', oxygen: false, annualClimbers: 200, annualTeams: 18, isEstimated: true, campKey: null },
  { id: 24, name: '梅拉峰', nameEn: 'Mera Peak', altitude: 6461, country: '尼泊尔', region: '喜马拉雅', difficulty: '入门6000m', season: '春季(4-5月)/秋季(10-11月)', operators: ['IMG', 'Seven Summit Treks', 'Himalayan Guides', 'Mera Peak Climbing', 'Glacier Safari Treks'], routes: '标准路线(北侧)', oxygen: false, annualClimbers: 1500, annualTeams: 100, isEstimated: true, campKey: '梅拉峰' },
  { id: 25, name: '岛峰', nameEn: 'Island Peak (Imja Tse)', altitude: 6189, country: '尼泊尔', region: '喜马拉雅', difficulty: '入门6000m', season: '春季(4-5月)/秋季(10-11月)', operators: ['IMG', 'Seven Summit Treks', 'Himalayan Guides', 'Island Peak Climbing'], routes: '标准路线/西壁', oxygen: false, annualClimbers: 2000, annualTeams: 150, isEstimated: true, campKey: '岛峰' },
  { id: 26, name: '哈巴雪山', nameEn: 'Haba Snow Mountain', altitude: 5396, country: '中国', region: '横断山脉', difficulty: '入门6000m', season: '春季(4-5月)/秋季(9-10月)', operators: ['玉珠峰探险', '横断山向导公司', '四川高山探险', 'Alpenglow Expeditions'], routes: '标准路线(西侧)', oxygen: false, annualClimbers: 800, annualTeams: 60, isEstimated: true, campKey: '哈巴雪山' },
  { id: 27, name: '四姑娘山大峰', nameEn: 'Four Girls Mountain (Da Peak)', altitude: 5025, country: '中国', region: '横断山脉', difficulty: '入门6000m', season: '春季(4-5月)/秋季(9-10月)', operators: ['四川四姑娘山探险', '蓝天救援队', '四川山地向导'], routes: '南坡标准路线', oxygen: false, annualClimbers: 600, annualTeams: 50, isEstimated: true, campKey: '四姑娘山' },
  { id: 28, name: '幺妹峰', nameEn: 'Siguniang (Yaomei Peak)', altitude: 6250, country: '中国', region: '横断山脉', difficulty: '技术型', season: '春季(4-5月)/秋季(9-10月)', operators: ['四川四姑娘山探险', '成都山地向导联盟'], routes: '东坡标准路线', oxygen: false, annualClimbers: 30, annualTeams: 3, isEstimated: true, campKey: '四姑娘山' },
  { id: 29, name: '玉珠峰', nameEn: 'Yuzhufeng', altitude: 6178, country: '中国', region: '昆仑山', difficulty: '入门6000m', season: '夏季(7-8月)', operators: ['玉珠峰探险', '中国登山协会', '西藏高山探险'], routes: '北坡标准路线', oxygen: false, annualClimbers: 500, annualTeams: 40, isEstimated: true, campKey: '玉珠峰' },
  { id: 30, name: '雀儿山', nameEn: 'Que Er Shan', altitude: 6168, country: '中国', region: '横断山脉', difficulty: '入门6000m', season: '夏季(7-8月)', operators: ['四川高山探险', '成都山地向导联盟'], routes: '东坡标准路线', oxygen: false, annualClimbers: 150, annualTeams: 12, isEstimated: true, campKey: '雀儿山' },
  { id: 31, name: '玉龙雪山', nameEn: 'Yulong Snow Mountain', altitude: 5596, country: '中国', region: '横断山脉', difficulty: '入门6000m', season: '春季(3-5月)/秋季(9-10月)', operators: ['云南山地向导公司', '丽江登山协会', '横断山探险'], routes: '主峰扇子陡北侧路线', oxygen: false, annualClimbers: 400, annualTeams: 30, isEstimated: true, campKey: '玉龙雪山' },
  { id: 32, name: '贡嘎山', nameEn: 'Minya Konka', altitude: 7556, country: '中国', region: '横断山脉', difficulty: '技术型', season: '春季(4-5月)/秋季(9-10月)', operators: ['四川高山探险', '成都山地向导联盟', '贡嘎登山服务'], routes: '东南山脊标准路线', oxygen: false, annualClimbers: 40, annualTeams: 4, isEstimated: true, campKey: '贡嘎山' },
  { id: 33, name: '启孜峰', nameEn: 'Qizhi Peak', altitude: 6206, country: '中国', region: '喜马拉雅', difficulty: '入门6000m', season: '春季(4-5月)/秋季(9-10月)', operators: ['西藏高山探险', '中国登山协会', '拉萨登山向导'], routes: '西南坡标准路线', oxygen: false, annualClimbers: 300, annualTeams: 25, isEstimated: true, campKey: '启孜峰' },
  { id: 34, name: '亚拉雪山', nameEn: 'Yala Snow Mountain', altitude: 5820, country: '中国', region: '横断山脉', difficulty: '入门6000m', season: '春季(4-6月)/秋季(9-10月)', operators: ['四川高山探险', '康定山地向导', '蓝天户外'], routes: '南坡常规路线', oxygen: false, annualClimbers: 200, annualTeams: 18, isEstimated: true, campKey: '亚拉雪山' },
];

export function registerCommercialModule(app) {
  Object.assign(app, {
    commercialPeaks: Array.isArray(app.commercialPeaks) && app.commercialPeaks.length ? app.commercialPeaks : COMMERCIAL_PEAKS,
    commercialFilter: app.commercialFilter || { region: '', difficulty: '', sortBy: 'altitude' },

    loadCommercialPeaks() {
      this.commercialPeaks = COMMERCIAL_PEAKS;
      return this.commercialPeaks;
    },

    filterCommercial(partial = {}) {
      this.commercialFilter = { ...this.commercialFilter, ...partial };
      return this.getFilteredCommercialPeaks();
    },

    getFilteredCommercialPeaks() {
      let peaks = this.commercialPeaks || [];
      if (this.commercialFilter.region) peaks = peaks.filter((p) => p.region === this.commercialFilter.region);
      if (this.commercialFilter.difficulty) peaks = peaks.filter((p) => p.difficulty === this.commercialFilter.difficulty);
      if (this.commercialFilter.sortBy === 'altitude') peaks = [...peaks].sort((a, b) => b.altitude - a.altitude);
      else if (this.commercialFilter.sortBy === 'annualClimbers') peaks = [...peaks].sort((a, b) => b.annualClimbers - a.annualClimbers);
      else if (this.commercialFilter.sortBy === 'difficulty') {
        const order = { '入门6000m': 1, '进阶7000m': 2, '技术型': 3, '8000m级': 4 };
        peaks = [...peaks].sort((a, b) => (order[b.difficulty] || 0) - (order[a.difficulty] || 0));
      }
      return peaks;
    },
  });
}
