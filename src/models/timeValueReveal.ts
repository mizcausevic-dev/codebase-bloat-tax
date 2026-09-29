/**
 * Potential time value is a labeled model, not recovered payroll.
 * Default public UI: hide the dollar figure until the operator opts in.
 * Evidence tier 1–2 (bundle artifact or CI timestamps) still does not auto-reveal
 * dollars, because hourly cost remains an operator assumption.
 */
export function shouldRevealModeledTimeValue(operatorOptIn: boolean): boolean {
  return operatorOptIn === true;
}
