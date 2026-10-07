import { REAL_CALIBRATION_RESULTS } from '../utils/constants.js';

export default function Calibration() {
  const res = REAL_CALIBRATION_RESULTS;

  return (
    <div className="page-calibration">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Optimization & Validation</p>
          <h2 className="page-title">Model Calibration</h2>
        </div>
        <div className="conn-badge online">
          <span className="conn-dot" />
          <span>Script Pipeline Configured</span>
        </div>
      </div>

      <div className="calib-two-col">
        {/* Genetic Algorithm Methodology */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Optimizer Engine</span>
            <h3>Genetic Algorithm (GA)</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Optimization Method</span>
              <span className="perf-val">Genetic Algorithm (ga_optimizer.py)</span>
            </div>
            <div className="perf-row">
              <span>Benchmark Dataset</span>
              <span className="perf-val font-mono">{res.dataset}</span>
            </div>
            <div className="perf-row">
              <span>Trajectory Comparisons</span>
              <span className="perf-val font-mono">{res.comparisons} Trajectories</span>
            </div>
            <div className="perf-row">
              <span>Congestion Failures</span>
              <span className="perf-val font-mono">{res.congestionFailures}</span>
            </div>
            <div className="perf-row">
              <span>Execution Pipeline</span>
              <span className="perf-val">scripts/calibrate/run_calibration.py</span>
            </div>
          </div>
        </section>

        {/* Validation Results */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Empirical Results</span>
            <h3>Calibration Run: {res.dataset}</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Average DTW (Dynamic Time Warping)</span>
              <span className="perf-val font-mono perf-ok">{res.averageDtw}</span>
            </div>
            <div className="perf-row">
              <span>Tangential Acc MSE</span>
              <span className="perf-val font-mono">{res.tanAccMse}</span>
            </div>
            <div className="perf-row">
              <span>Lateral Acc MSE</span>
              <span className="perf-val font-mono">{res.latAccMse}</span>
            </div>
            <div className="perf-row">
              <span>Composite Weighted Loss</span>
              <span className="perf-val font-mono perf-ok">{res.weightedLoss}</span>
            </div>
            <div className="perf-row">
              <span>Loss Weights</span>
              <span className="perf-val font-mono">w1=1.0, w2=0.055, w3=0.163</span>
            </div>
          </div>
          <div className="calib-note">
            Values sourced directly from <code>scripts/calibrate/validation_results.txt</code>.
          </div>
        </section>
      </div>

      <div className="info-banner" style={{ marginTop: '20px' }}>
        <strong>Calibration Architecture:</strong> The Genetic Algorithm optimizes microscopic IDM car-following headways and Social Force Model lateral interaction parameters against real-world Indian trajectory data.
      </div>
    </div>
  );
}
