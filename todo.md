# Amazon Ads Analyzer - TODO

## Phase 2: 后端核心引擎
- [x] 设计数据库Schema（分析任务、报表文件、分析结果）
- [x] 实现报表类型自动识别逻辑
- [x] 实现5类报表字段标准化
- [x] 实现负责人识别规则引擎（CL1优先，正则匹配）
- [x] 实现核心指标计算（CVR/CTR/ACOS/ROAS/CPC/TACOS等）
- [x] 实现诊断规则引擎（15条规则）
- [x] 实现文件上传API（S3存储）
- [x] 实现分析任务触发与结果存储API
- [x] 实现各维度分析结果查询API

## Phase 3: 前端上传与总览
- [x] 设计整体视觉风格（深色优雅主题，专业配色）
- [x] 实现文件上传页面（5类报表拖拽上传）
- [x] 实现分析流程可视化（步骤进度条）
- [x] 实现账户总览仪表盘（指标卡片、图表）

## Phase 4: 前端分析报告
- [x] 实现负责人绩效分析页
- [x] 实现Campaign优化建议列表
- [x] 实现Targeting优化建议
- [x] 实现Search Term三类清单（否词/转精准/放大）
- [x] 实现最终运营动作清单（支持CSV下载）

## Phase 5: 测试与精修
- [x] 编写Vitest单元测试（15条全部通过）
- [x] 样式精修与响应式适配
- [x] 最终交付

## Phase 6: 负责人筛选功能
- [x] Analysis.tsx 顶层增加统一负责人筛选器（下拉选择 + 全部/各负责人）
- [x] AccountOverviewTab 支持按负责人过滤 ownerAnalysis 数据展示
- [x] CampaignSuggestionsTab 接收 ownerFilter prop，按负责人过滤
- [x] TargetingSuggestionsTab 接收 ownerFilter prop，按负责人过滤
- [x] SearchTermTab 接收 ownerFilter prop，按负责人过滤
- [x] ActionItemsTab 接收 ownerFilter prop，按负责人过滤
- [x] OwnerAnalysisTab 筛选后高亮/聚焦选中负责人

## Phase 7: 报表解析Bug修复 + 搜索词核心化
- [x] 修复routers.ts中文件读取404问题（改用storageGetSignedUrl）
- [x] 修复Targeting Report误识别问题（识别顺序：Search Term > Targeting > Business > Advertised > Campaign）
- [x] 修复字段名末尾空格问题（trim处理）
- [x] 修复switch改用parsed.reportType而非存储时的file.reportType
- [x] 新增SearchTermAnalysis深度分析引擎（词级别聚合、词性分类、标签判断）
- [x] 数据库新增searchTermAnalysis字段
- [x] 重构SearchTermTab：10个Tab包含概览、高价值词、亏损词、无效词、潜力词、花费TOP词、否词、转精准、放大、负责人词汇总

## Phase 8: 图二维度分析 + 词根分析
- [x] 修复花费TOP词数据传递问题（topTermsBySpend未传入前端）
- [x] 后端新增词根提取引擎（词根聚合花费/订单/ACOS）
- [x] 后端新增匹配类型维度分析（Exact/Phrase/Broad/Auto对比）
- [x] 后端新增广告组合维度分析（Portfolio级别汇总）
- [x] 前端新增词根分析Tab（词根排名、词根下词列表）
- [x] 前端新增匹配类型分析Tab（柱状图对比）
- [x] 前端新增运营人员分析Tab（搜索词维度的负责人对比）
- [x] 前端新增搜索词二维散点图（花费 vs CVR，气泡大小=订单数）

## Phase 9: 匹配类型分析板块升级
- [x] 匹配类型分析：详细数据表格（展示量/点击量/CTR/花费/销售额/转化率/ACOS/ROAS）
- [x] 匹配类型分析：花费占比环形图（各类型颜色与MATCH_COLORS一致）
- [x] 匹配类型分析：合理性判断（精确匹配≥70%绿色合理，50-70%橙色预警，<50%红色警告）
- [x] 匹配类型分析：负责人筛选联动（通过ownerBreakdown按负责人重新聚合数据）
- [x] 后端analysisEngine增加ownerBreakdown字段，按负责人分组存储各匹配类型数据
