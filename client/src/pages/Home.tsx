import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  BarChart3,
  Target,
  Users,
  Zap,
  ArrowRight,
  TrendingUp,
  Search,
  FileText,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "智能报表识别",
    desc: "自动识别5类亚马逊广告报表，统一字段标准，无需手动配置",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Users,
    title: "负责人归因",
    desc: "从Campaign Name精准识别10位负责人，按规则优先级匹配，CL1优先于CL",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: BarChart3,
    title: "核心指标计算",
    desc: "自动计算CVR、CTR、ACOS、ROAS、CPC、TACOS等全套广告指标",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Target,
    title: "规则引擎诊断",
    desc: "15条诊断规则，识别ACOS超标、点击无单、CVR异常等优化机会",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Search,
    title: "Search Term清单",
    desc: "自动生成否词建议、转精准建议、放大投放建议三类执行清单",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: Zap,
    title: "运营动作清单",
    desc: "汇总所有优化建议为P1/P2/P3优先级清单，支持CSV下载导出",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
];

const REPORT_TYPES = [
  { name: "Business Report", desc: "Session、转化率、自然销量", color: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30" },
  { name: "Campaign Report", desc: "广告活动层级表现", color: "bg-blue-400/20 text-blue-300 border-blue-400/30" },
  { name: "Targeting Report", desc: "关键词/ASIN投放表现", color: "bg-purple-400/20 text-purple-300 border-purple-400/30" },
  { name: "Search Term Report", desc: "真实搜索词分析", color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30" },
  { name: "Advertised Product Report", desc: "被推广产品表现", color: "bg-orange-400/20 text-orange-300 border-orange-400/30" },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const handleStart = () => {
    if (isAuthenticated) {
      navigate("/upload");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background font-['Inter',sans-serif]">
      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Amazon Ads</span>
              <span className="ml-1 text-sm text-muted-foreground">智能分析系统</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading ? null : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {user?.name ?? "用户"}
                </span>
                <Button size="sm" onClick={() => navigate("/upload")}>
                  开始分析
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleStart}>
                登录开始使用
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
            <Zap className="h-3.5 w-3.5" />
            <span>亚马逊广告运营智能体</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 leading-tight">
            上传报表
            <span className="gradient-text mx-3">5秒</span>
            生成<br />完整运营优化方案
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            自动识别5类广告报表，按负责人归因，计算CVR/CTR/ACOS等核心指标，
            输出账户总览、Campaign建议、Search Term清单和运营动作清单。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 h-12" onClick={handleStart}>
              {isAuthenticated ? "开始分析报表" : "免费开始使用"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            {isAuthenticated && (
              <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => navigate("/dashboard")}>
                查看历史分析
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 支持的报表类型 */}
      <section className="py-16 border-y border-border/50">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-widest">
            支持5类亚马逊广告报表
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {REPORT_TYPES.map((rt) => (
              <div
                key={rt.name}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${rt.color}`}
              >
                <FileText className="h-4 w-4" />
                <div>
                  <div className="font-semibold">{rt.name}</div>
                  <div className="text-xs opacity-70">{rt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              完整的广告分析流程
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              从报表上传到运营动作清单，全程自动化处理，让广告优化更高效
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="group rounded-xl border border-border/50 bg-card p-6 card-hover"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg} mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 分析流程步骤 */}
      <section className="py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">分析流程</h2>
          </div>
          <div className="flex flex-col md:flex-row items-start justify-center gap-0">
            {[
              { step: "01", title: "上传报表", desc: "拖拽上传5类报表文件" },
              { step: "02", title: "自动识别", desc: "智能识别类型并标准化字段" },
              { step: "03", title: "负责人归因", desc: "从Campaign Name识别负责人" },
              { step: "04", title: "指标计算", desc: "计算CVR/CTR/ACOS等核心指标" },
              { step: "05", title: "规则诊断", desc: "15条规则判断优化机会" },
              { step: "06", title: "输出报告", desc: "生成完整运营动作清单" },
            ].map((s, i, arr) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center text-center w-32">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm mb-3">
                    {s.step}
                  </div>
                  <div className="font-medium text-foreground text-sm mb-1">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-border mx-2 flex-shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container text-center">
          <div className="max-w-2xl mx-auto rounded-2xl border border-primary/20 bg-primary/5 p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              立即开始分析您的广告数据
            </h2>
            <p className="text-muted-foreground mb-8">
              上传报表，5秒内获得完整的广告优化建议和运营动作清单
            </p>
            <Button size="lg" className="text-base px-10 h-12" onClick={handleStart}>
              {isAuthenticated ? "上传报表开始分析" : "登录后开始使用"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          Amazon Ads 智能分析系统 · 专为亚马逊运营团队设计
        </div>
      </footer>
    </div>
  );
}
