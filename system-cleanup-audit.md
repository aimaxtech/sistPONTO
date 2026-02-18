# Task: System Cleanup & Performance Audit 🧹⚡

Audit, cleanup, and optimization of the **sistPONTO** codebase.

## Objective
* Remove obsolete collection references (`punches`).
* Centralize and standardize time calculation logic.
* Optimize dashboard performance (real-time listeners, debounce).
* Remove dead code and unused imports.

## Phase 1: Cleanup
- [x] Remove `punches` collection references in `PunchButton.jsx`.
- [x] Remove `punches` collection references in `EmployeeDashboard.jsx`.
- [x] Search for any other `punches` reference in the codebase.
- [x] Centralize `getTodayStr` and `UTC-3` logic in `timeUtils.js`.
- [x] Update `firestore.rules` to secure the `logs` collection.

## Phase 2: Performance
- [x] Implement search enhancement in `AdminDashboard.jsx`.
- [ ] Move dynamic imports to the top of files in `EmployeeDashboard.jsx` (Mantenho dinâmico para ganhos de "Initial Bundle Size" se preferir, ou mover se prejudicar).
- [x] Optimize `onSnapshot` inside `EmployeeDashboard.jsx` (Reduzido fuso horário local).

## Phase 3: Final Checks
- [ ] Run `python .agent/scripts/checklist.py .` to ensure quality.
- [x] Verify build and deploy.

---

## 📅 Log de Execução

- **2026-02-18**: Início da auditoria técnica.
- **Limpeza**: Removidas todas as referências à coleção `punches` e chaves obsoletas do `localStorage`. Centralizada regra de fuso horário UTC-3.
- **Segurança**: Descoberta ausência de regras para a coleção `logs`. Regras aplicadas imediatamente protegendo dados confidenciais dos funcionários.
- **UI**: Banco de horas agora exibe valores reais coloridos na lista de equipe. Busca de funcionários otimizada.
