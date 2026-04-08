# Roadmap

## v1.1.0 - Better analysis

- [x] Multi-sample collection for `analyze_server`
- [x] Configurable anomaly thresholds
- [ ] Memory z-score anomaly detection
- [ ] Network anomaly detection for unusual rx and tx spikes
- [x] Parallel SSH command execution

## v1.2.0 - Multi-host

- [ ] `analyze_fleet` tool to analyze multiple hosts in parallel and return a ranked summary
- [ ] `get_fleet_history` tool to compare trends across a fleet
- [ ] Host group configuration via JSON file

## v1.3.0 - Alerting hooks

- [ ] Webhook delivery when health score drops below a threshold
- [ ] Slack notification integration
- [ ] Alert deduplication for persistent anomalies

## v2.0.0 - Agent mode

- [ ] Autonomous monitoring runs on a schedule
- [ ] Incident timeline reconstruction from historical data
- [ ] Self-healing recommendations with before and after comparisons

## Won't do

- Built-in web UI
- Windows host support
- Push-based agent metrics collection
