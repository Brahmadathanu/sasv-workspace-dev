function buildOutputsQuery(dataset) {
  switch (dataset) {
    case "baseline":
      return {
        table: "v_forecast_baseline_effective",
        cols: [
          "sku_id",
          "region_id",
          "godown_id",
          "month_start",
          "demand_baseline",
          "override_delta",
          "demand_effective",
        ],
      };
    case "llt":
      return {
        table: "sku_forecast_monthly_llt",
        cols: ["sku_id", "region_id", "godown_id", "month_start", "y_supply"],
      };
    case "seasonal":
      return {
        table: "sku_forecast_monthly_seasonal",
        cols: ["sku_id", "region_id", "godown_id", "month_start", "y_supply"],
      };
    case "combined":
    default:
      return {
        table: "v_forecast_plan_12m",
        cols: [
          "sku_id",
          "region_id",
          "godown_id",
          "month_start",
          "demand_baseline",
          "supply_llt",
          "supply_seasonal",
          "supply_final",
        ],
      };
  }
}

function displayColsFor(dataset) {
  const cfg = buildOutputsQuery(dataset);
  const hasSku = cfg.cols.includes("sku_id");
  const hasRegion = cfg.cols.includes("region_id");
  const hasGodown = cfg.cols.includes("godown_id");
  const otherCols = cfg.cols.filter(
    (c) => !["sku_id", "region_id", "godown_id"].includes(c)
  );
  const displayCols = [];
  if (hasSku) displayCols.push("sku_id", "item", "pack_size", "uom");
  if (hasRegion) displayCols.push("region");
  if (hasGodown) displayCols.push("godown");
  displayCols.push(...otherCols);
  return displayCols;
}

["baseline", "llt", "seasonal", "combined"].forEach((ds) => {
  console.log(ds, displayColsFor(ds));
});
