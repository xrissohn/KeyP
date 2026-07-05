declare module "google-trends-api" {
  interface BaseOptions {
    keyword: string | string[];
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    startTime?: Date;
    endTime?: Date;
  }
  function interestOverTime(opts: BaseOptions): Promise<string>;
  function interestByRegion(opts: BaseOptions): Promise<string>;
  function relatedQueries(opts: BaseOptions): Promise<string>;
  function relatedTopics(opts: BaseOptions): Promise<string>;
  function dailyTrends(opts: { geo?: string; hl?: string; trendDate?: Date }): Promise<string>;
  function realTimeTrends(opts: {
    geo?: string;
    category?: string;
    hl?: string;
  }): Promise<string>;

  const _default: {
    interestOverTime: typeof interestOverTime;
    interestByRegion: typeof interestByRegion;
    relatedQueries: typeof relatedQueries;
    relatedTopics: typeof relatedTopics;
    dailyTrends: typeof dailyTrends;
    realTimeTrends: typeof realTimeTrends;
  };
  export default _default;
  export {
    interestOverTime,
    interestByRegion,
    relatedQueries,
    relatedTopics,
    dailyTrends,
    realTimeTrends,
  };
}
