import React, { useEffect, useMemo, useState } from "react";
import "../../../css/PieChart.css";
import { useError } from "../../../components/ErrorContext";
import { getGoals } from "../../../api/objectivesApi";
import { buildGoalStatusDistribution } from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

export default function PieChart({ goals: externalGoals = null }) {
  const { t } = useLanguage();
  const [goals, setGoals] = useState(
    Array.isArray(externalGoals) ? externalGoals : [],
  );
  const { setErrorMessage } = useError();

  const getStatusLabel = (statusKey) => {
    if (statusKey === "NotStarted") return t.goalStatusNotStarted;
    if (statusKey === "InProgress") return t.goalStatusInProgress;
    if (statusKey === "Done") return t.goalStatusDone;
    return statusKey;
  };

  useEffect(() => {
    if (Array.isArray(externalGoals)) {
      setGoals(externalGoals);
      return;
    }

    const loadGoals = async () => {
      try {
        const response = await getGoals();
        setGoals(Array.isArray(response) ? response : []);
      } catch (error) {
        setErrorMessage(error.message || "No se pudieron cargar los goals.");
        setGoals([]);
      }
    };

    loadGoals();
  }, [externalGoals, setErrorMessage]);

  const metrics = useMemo(() => {
    const goalDistribution = buildGoalStatusDistribution(goals);

    let startAngle = 0;
    const donutSegments = goalDistribution
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const endAngle = startAngle + segment.percent * 360;
        const cssSegment = `${segment.color} ${startAngle}deg ${endAngle}deg`;
        startAngle = endAngle;
        return cssSegment;
      });

    const donutBackground =
      donutSegments.length > 0
        ? `conic-gradient(${donutSegments.join(", ")})`
        : "conic-gradient(rgba(255,255,255,0.1) 0deg 360deg)";

    return {
      goalDistribution,
      donutBackground,
      totalGoals: goals.length,
    };
  }, [goals]);

  if (!goals || goals.length === 0) {
    return (
      <div className="chartContainer">
        <div className="emptyState">
          <p>No hay goals para mostrar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chartContainer">
      <div className="donutChartLayout">
        <div
          className="goalsDonut"
          style={{ background: metrics.donutBackground }}
        >
          <div className="goalsDonutCenter">
            <span>{metrics.totalGoals}</span>
            <small>Total</small>
          </div>
        </div>

        <div className="donutLegend">
          {metrics.goalDistribution.map((segment) => (
            <div key={segment.key} className="legendItem">
              <span
                className="legendColor"
                style={{ backgroundColor: segment.color }}
              ></span>
              <span className="legendText">
                {getStatusLabel(segment.key)} ({segment.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
