import Ajv from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { readFile } from 'node:fs/promises';
const response = await fetch('https://render.com/schema/render.yaml.json');
if (!response.ok) throw new Error(`Render schema: HTTP ${response.status}`);
const schema = await response.json();
const config = parse(await readFile('render.yaml', 'utf8'));
const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
  schema,
);
if (!validate(config)) {
  console.error(validate.errors);
  process.exitCode = 1;
} else console.log('render.yaml válido conforme JSON Schema oficial do Render.');
