// @traceit:start
// @traceit:title: Sample Function
// @traceit:description: A sample function for testing
// @traceit:domain: test
// @traceit:exports: sampleFunc
export function sampleFunc(): string {
  return 'hello';
}
// @traceit:end

// Another regular function without annotation
export function regularFunc(): void {
  console.log('no annotation');
}