import { searchMasterDatabase } from './src/services/domainService.js';

async function run() {
  console.log("Testing searchMasterDatabase...");
  const res = await searchMasterDatabase('miragenews.com');
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
