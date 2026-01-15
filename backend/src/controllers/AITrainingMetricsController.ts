import { Request, Response } from "express";
import { Op, fn, col, literal } from "sequelize";
import AITrainingFeedback from "../models/AITrainingFeedback";
import AITrainingImprovement from "../models/AITrainingImprovement";
import AITestScenario from "../models/AITestScenario";
import AITestResult from "../models/AITestResult";
import AIPromptVersion from "../models/AIPromptVersion";

interface MetricsQuery {
  agentId?: string;
  stageId?: string;
  startDate?: string;
  endDate?: string;
}

export const getTrainingMetrics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId, startDate, endDate } = req.query as MetricsQuery;

  try {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.createdAt = { [Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        [Op.lte]: new Date(endDate)
      };
    }

    const feedbackWhere: any = { companyId, ...dateFilter };
    if (agentId) feedbackWhere.agentId = agentId;
    if (stageId) feedbackWhere.stageId = stageId;

    const totalFeedbacks = await AITrainingFeedback.count({ where: feedbackWhere });

    const positiveFeedbacks = await AITrainingFeedback.count({
      where: { ...feedbackWhere, rating: "correct" }
    });

    const negativeFeedbacks = await AITrainingFeedback.count({
      where: { ...feedbackWhere, rating: "wrong" }
    });

    const improvementWhere: any = { companyId, ...dateFilter };
    if (agentId) improvementWhere.agentId = agentId;
    if (stageId) improvementWhere.stageId = stageId;

    const improvementsSuggested = await AITrainingImprovement.count({
      where: improvementWhere
    });

    const improvementsApplied = await AITrainingImprovement.count({
      where: { ...improvementWhere, applied: true }
    });

    const testResultWhere: any = { companyId };
    const testsTotal = await AITestResult.count({ where: testResultWhere });
    const testsPassed = await AITestResult.count({
      where: { ...testResultWhere, passed: true }
    });

    const avgSimilarityResult = await AITestResult.findOne({
      attributes: [[fn("AVG", col("similarity")), "avgSimilarity"]],
      where: testResultWhere,
      raw: true
    });
    const avgSimilarity = (avgSimilarityResult as any)?.avgSimilarity || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentNegatives = await AITrainingFeedback.count({
      where: {
        ...feedbackWhere,
        rating: "wrong",
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    const versionWhere: any = { companyId };
    if (agentId) versionWhere.agentId = agentId;
    if (stageId) versionWhere.stageId = stageId;

    const promptVersions = await AIPromptVersion.count({ where: versionWhere });

    const feedbackTrend: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayWhere = {
        ...feedbackWhere,
        createdAt: { [Op.between]: [dayStart, dayEnd] }
      };

      const positive = await AITrainingFeedback.count({
        where: { ...dayWhere, rating: "correct" }
      });
      const negative = await AITrainingFeedback.count({
        where: { ...dayWhere, rating: "wrong" }
      });

      feedbackTrend.push({
        date: dayStart.toISOString().split("T")[0],
        positive,
        negative
      });
    }

    const categoryDistribution: Record<string, number> = {};
    const categories = await AITrainingFeedback.findAll({
      attributes: [
        "category",
        [fn("COUNT", col("id")), "count"]
      ],
      where: { ...feedbackWhere, category: { [Op.ne]: null } },
      group: ["category"],
      raw: true
    });

    categories.forEach((c: any) => {
      if (c.category) {
        categoryDistribution[c.category] = parseInt(c.count, 10);
      }
    });

    return res.json({
      totalFeedbacks,
      positiveFeedbacks,
      negativeFeedbacks,
      improvementsSuggested,
      improvementsApplied,
      testsTotal,
      testsPassed,
      avgSimilarity: parseFloat(avgSimilarity.toFixed(2)),
      recentNegatives,
      promptVersions,
      feedbackTrend,
      categoryDistribution
    });
  } catch (err: any) {
    console.error("Error getting training metrics:", err);
    return res.status(500).json({ error: "Failed to get training metrics" });
  }
};
