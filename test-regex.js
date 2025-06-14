const input = 'Check out [this method](https://developer.apple.com/documentation/foundationmodels/tool/call(arguments:)) for details.';

// Test different regex patterns
const patterns = [
  // Original pattern
  /\[([^\]]+)\]\([^)]+\)/g,
  // First attempt
  /\[([^\]]+)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g,
  // Second attempt  
  /\[([^\]]+)\]\(([^)]*(?:\([^)]*\))*[^)]*)\)/g,
  // Let's try a different approach - match balanced parentheses
  /\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
  // Another approach - use lookahead
  /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g,
];

console.log('Input:', input);
console.log('\n');

patterns.forEach((pattern, index) => {
  console.log(`Pattern ${index + 1}: ${pattern}`);
  const result = input.replace(pattern, '$1');
  console.log('Result:', result);
  console.log('---');
});