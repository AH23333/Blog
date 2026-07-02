import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  htmlLabels: true,
  securityLevel: "loose"
});

// Test the 16.1 Micrometer diagram - the fix is to remove semicolons (;) from Note text
// because Mermaid's sequence diagram parser interprets ; as statement terminators
// even inside Note text. { and } are safe as long as there's no ; inside them.
const diagram = [
  "sequenceDiagram",
  "    participant APP as Spring Boot 应用",
  "    participant METER as MeterRegistry",
  "    participant COUNTER as Counter<br/>计数器",
  "    participant TIMER as Timer<br/>计时器",
  "    participant GAUGE as Gauge<br/>瞬时值",
  "    participant PROM as Prometheus Endpoint",
  "",
  "    rect rgba(240, 248, 255, 0.4)",
  "    Note over APP,METER: ===== 阶段 1：指标注册 [INF] → Micrometer =====",
  "    APP->>METER: 创建 Meter 实例",
  "    Note over METER: Micrometer 核心接口：<br/>MeterRegistry：指标注册中心<br/>Meter：指标基类<br/>Tag：维度标签（Key-Value）<br/>MeterFilter：指标过滤器",
  "    Note over METER: 支持的监控系统：<br/>Prometheus、Graphite、JMX、<br/>Datadog、InfluxDB、New Relic<br/>通过 SPI 机制自动适配",
  "    end",
  "",
  "    rect rgba(248, 240, 255, 0.4)",
  "    Note over APP,COUNTER: ===== 阶段 2：Counter 计数器 [INF] → 单调递增 =====",
  "    APP->>COUNTER: 秒杀请求计数",
  '    Note over COUNTER: Counter 使用示例：<br/>Counter seckillCounter = Counter.builder("seckill.requests.total")<br/>  .tag("status", "success")<br/>  .description("秒杀成功请求总数")<br/>  .register(meterRegistry)<br/>seckillCounter.increment()',
  "    Note over COUNTER: Counter 适用场景：<br/>1. HTTP 请求总数<br/>2. 错误总数<br/>3. 订单创建总数<br/>4. 消息发送总数<br/>特点：只增不减，重启归零",
  "    end",
  "",
  "    rect rgba(255, 248, 240, 0.4)",
  "    Note over APP,TIMER: ===== 阶段 3：Timer 计时器 [INF] → 延迟分布 =====",
  "    APP->>TIMER: 记录接口耗时",
  '    Note over TIMER: Timer 使用示例：<br/>Timer timer = Timer.builder("seckill.request.duration")<br/>  .tag("api", "createOrder")<br/>  .publishPercentiles(0.5, 0.95, 0.99)<br/>  .register(meterRegistry)<br/>timer.record(() → { seckillService.execute() })',
  "    Note over TIMER: Timer 底层实现：<br/>1. 记录每次耗时<br/>2. 内部维护 Histogram<br/>3. 自动计算 P50/P95/P99<br/>4. 同时生成 _count、_sum、_max<br/>5. Prometheus 中为 Summary 类型",
  "    end",
  "",
  "    rect rgba(240, 255, 248, 0.4)",
  "    Note over APP,GAUGE: ===== 阶段 4：Gauge 瞬时值 [INF] → 可增可减 =====",
  "    APP->>GAUGE: 记录队列长度/连接数",
  '    Note over GAUGE: Gauge 使用示例：<br/>Gauge.builder("seckill.queue.size", queue, queue::size)<br/>  .tag("queue", "order")<br/>  .register(meterRegistry)',
  "    Note over GAUGE: Gauge 适用场景：<br/>1. 线程池活跃线程数<br/>2. 数据库连接池活跃连接数<br/>3. JVM 堆内存使用量<br/>4. Kafka 消费延迟<br/>5. 消息队列积压数量",
  "    end",
  "",
  "    rect rgba(255, 240, 245, 0.4)",
  "    Note over APP,PROM: ===== 阶段 5：指标暴露 [INF] → Prometheus 格式 =====",
  "    APP->>PROM: GET /actuator/prometheus",
  '    Note over PROM: 暴露的指标格式：<br/># HELP seckill_requests_total 秒杀请求总数<br/># TYPE seckill_requests_total counter<br/>seckill_requests_total{status="success"} 12345<br/>seckill_requests_total{status="failed"} 89<br/># HELP seckill_request_duration_seconds<br/># TYPE seckill_request_duration_seconds summary<br/>seckill_request_duration_seconds{quantile="0.5"} 0.012<br/>seckill_request_duration_seconds{quantile="0.99"} 0.287',
  '    Note over PROM: 配置暴露端点：<br/>management.endpoints.web.exposure.include=prometheus<br/>management.metrics.tags.application=${spring.application.name}',
  "    end"
].join("\n");

const id = "mermaid-16-1-" + Math.random().toString(36).slice(2, 9);

try {
  const { svg } = await mermaid.render(id, diagram);
  console.log("SUCCESS: 16.1 Micrometer diagram rendered successfully");
  console.log("SVG length:", svg.length);
} catch (err) {
  console.log("ERROR:", err instanceof Error ? err.message : String(err));
}