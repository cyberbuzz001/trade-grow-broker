export interface OptionGreeks {
  iv: number;          // Implied Volatility (%)
  delta: number;       // Delta (Rate of change of option price per $1 change in spot)
  gamma: number;       // Gamma (Rate of change of Delta per $1 change in spot)
  theta: number;       // Theta (Time decay per calendar day)
  vega: number;        // Vega (Sensitivity to 1% change in IV)
}

export class GreeksEngine {
  private static RISK_FREE_RATE = 0.07; // 7.0% Indian RBI Repo / MIBOR Benchmark Rate

  /**
   * Cumulative Standard Normal Distribution Function N(x) using Abramowitz and Stegun approximation
   */
  public static CND(x: number): number {
    const a1 = 0.31938153;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const L = Math.abs(x);
    const K = 1.0 / (1.0 + 0.2316419 * L);
    let cnd = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2.0) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
    if (x < 0) {
      cnd = 1.0 - cnd;
    }
    return cnd;
  }

  /**
   * Standard Normal Probability Density Function N'(x)
   */
  public static ND(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Calculates Black-Scholes Option Greeks
   * @param spot Current Spot Price S
   * @param strike Strike Price K
   * @param timeToExpiryYears Time to expiry in years T
   * @param isCall True for Call (CE), False for Put (PE)
   * @param iv Implied Volatility in decimal (e.g. 0.15 for 15%)
   */
  public static calculateGreeks(
    spot: number,
    strike: number,
    timeToExpiryYears: number = 0.08, // ~30 days
    isCall: boolean = true,
    iv: number = 0.15
  ): OptionGreeks {
    if (spot <= 0 || strike <= 0 || timeToExpiryYears <= 0 || iv <= 0) {
      return {
        iv: Number((iv * 100).toFixed(2)),
        delta: isCall ? 0.5 : -0.5,
        gamma: 0.002,
        theta: -10.0,
        vega: 15.0
      };
    }

    const r = this.RISK_FREE_RATE;
    const sqrtT = Math.sqrt(timeToExpiryYears);

    const d1 = (Math.log(spot / strike) + (r + 0.5 * iv * iv) * timeToExpiryYears) / (iv * sqrtT);
    const d2 = d1 - (iv * sqrtT);

    const nD1 = this.CND(d1);
    const nD2 = this.CND(d2);
    const pdfD1 = this.ND(d1);

    // Delta
    const delta = isCall ? nD1 : nD1 - 1.0;

    // Gamma
    const gamma = pdfD1 / (spot * iv * sqrtT);

    // Theta (expressed per calendar day)
    const term1 = -(spot * pdfD1 * iv) / (2 * sqrtT);
    const term2 = r * strike * Math.exp(-r * timeToExpiryYears) * (isCall ? nD2 : this.CND(-d2));
    const thetaAnnual = isCall ? term1 - term2 : term1 + term2;
    const theta = thetaAnnual / 365.0;

    // Vega (expressed per 1% change in IV)
    const vega = (spot * sqrtT * pdfD1) / 100.0;

    return {
      iv: Number((iv * 100).toFixed(2)),
      delta: Number(delta.toFixed(3)),
      gamma: Number(gamma.toFixed(5)),
      theta: Number(theta.toFixed(2)),
      vega: Number(vega.toFixed(2))
    };
  }
}
