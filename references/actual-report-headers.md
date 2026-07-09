# 实际报表列名（从日志提取 2026-07-09）

## Advertised Product Report
Start Date | End Date | Portfolio name | Currency | Campaign Name | Ad Group Name | Retailer | Country | Advertised SKU | Advertised ASIN | Impressions | Clicks | Click-Thru Rate (CTR) | Cost Per Click (CPC) | Spend | 7 Day Total Sales  | Total Advertising Cost of Sales (ACOS)  | Total Return on Advertising Spend (ROAS) | 7 Day Total Orders (#) | 7 Day Total Units (#) | 7 Day Conversion Rate | 7 Day Advertised SKU Units (#) | 7 Day Other SKU Units (#) | 7 Day Advertised SKU Sales  | 7 Day Other SKU Sales

注意：数字列名末尾有空格，如 "7 Day Total Sales " (带空格)

## Campaign Report (CSV)
Start Date | End Date | Portfolio name | Program Type | Campaign Name | Retailer | Country | Status | Currency | Budget Amount | Targeting Type | Bidding strategy | Impressions | Last Year Impressions | Clicks | Last Year Clicks | Click-Thru Rate (CTR) | Spend | Last Year Spend | Cost Per Click (CPC) | Last Year Cost Per Click (CPC) | 7 Day Total Orders (#) | Total Advertising Cost of Sales (ACOS)  | Total Return on Advertising Spend (ROAS) | 7 Day Total Sales

注意：预算列名是 "Budget Amount" 不是 "Budget"；没有 "7 Day Total Sales ($)" 只有 "7 Day Total Sales"（末尾有空格）

## Targeting Report (XLSX)
Start Date | End Date | Portfolio name | Currency | Campaign Name | Country | Ad Group Name | Retailer | Targeting | Match Type | Impressions | Top-of-search Impression Share | Clicks | Click-Thru Rate (CTR) | Cost Per Click (CPC) | Spend | Total Advertising Cost of Sales (ACOS)  | Total Return on Advertising Spend (ROAS) | 7 Day Total Sales  | 7 Day Total Orders (#) | 7 Day Total Units (#) | 7 Day Conversion Rate | 7 Day Advertised SKU Units (#) | 7 Day Other SKU Units (#) | 7 Day Advertised SKU Sales  | 7 Day Other SKU Sales

注意：有 "Top-of-search Impression Share" 列（无空格），有 "Targeting" 和 "Match Type"，无 "Advertised SKU" 列
问题：被误识别为 advertised_product_report，因为识别顺序中 "Advertised SKU" 检查在 "Top-of-search" 之前，且 Targeting Report 有 "7 Day Advertised SKU Units (#)" 列触发了误判

## Search Term Report (XLSX)
Start Date | End Date | Portfolio name | Currency | Campaign Name | Ad Group Name | Retailer | Country | Targeting | Match Type | Customer Search Term | Impressions | Clicks | Click-Thru Rate (CTR) | Cost Per Click (CPC) | Spend | 7 Day Total Sales  | Total Advertising Cost of Sales (ACOS)  | Total Return on Advertising Spend (ROAS) | 7 Day Total Orders (#) | 7 Day Total Units (#) | 7 Day Conversion Rate | 7 Day Advertised SKU Units (#) | 7 Day Other SKU Units (#) | 7 Day Advertised SKU Sales  | 7 Day Other SKU Sales

## Business Report (CSV, 中文)
（父）ASIN | （子）ASIN | 标题 | SKU | 会话数 - 总计 | 会话 - 总计 - B2B | 转化率 - 总计 | 会话百分比 - 总计 - B2B | 页面浏览量 - 总计  | 页面浏览量 - 总计 - B2B | 页面浏览量百分比 - 总计 | 页面浏览量百分比 - 总计 - B2B | 推荐报价（推荐报价展示位）百分比  | 推荐报价（推荐报价展示位）百分比 - B2B | 已订购商品数量 | 已订购商品数量 - B2B | 商品会话百分比 | 商品会话百分比 - B2B | 已订购商品销售额 | 已订购商品销售额 - B2B | 订单商品总数 | 订单商品总数 - B2B

## 关键修复点
1. 报表类型识别顺序：Search Term > Targeting (Top-of-search) > Business > Advertised Product > Campaign
2. 字段名末尾空格：所有 "7 Day Total Sales " 等列名末尾有空格，get() 函数需要 trim 处理
3. Campaign Report 预算列：Budget Amount（不是 Budget）
4. Business Report ASIN列：（子）ASIN（不是"子ASIN"）
5. Business Report 转化率：转化率 - 总计（不是"转化率"）
6. Business Report 推荐报价：推荐报价（推荐报价展示位）百分比（不是"推荐报价百分比"）
