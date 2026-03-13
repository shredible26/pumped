const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'AsyncNgrok.js',
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');

if (source.includes('const ngrokBody = error == null ? void 0 : error.body;')) {
  process.exit(0);
}

source = source.replace(
  "                if ((0, _NgrokResolver.isNgrokClientError)(error)) {\n                    var _error_body_details;\n                    throw new _errors.CommandError('NGROK_CONNECT', [\n                        error.body.msg,\n                        (_error_body_details = error.body.details) == null ? void 0 : _error_body_details.err,\n                        _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')\n                    ].filter(Boolean).join('\\n\\n'));\n                }\n",
  "                const ngrokBody = error == null ? void 0 : error.body;\n                if ((0, _NgrokResolver.isNgrokClientError)(error) && ngrokBody) {\n                    var _error_body_details;\n                    throw new _errors.CommandError('NGROK_CONNECT', [\n                        ngrokBody.msg,\n                        (_error_body_details = ngrokBody.details) == null ? void 0 : _error_body_details.err,\n                        _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')\n                    ].filter(Boolean).join('\\n\\n'));\n                }\n",
);

source = source.replace(
  "            if ((0, _NgrokResolver.isNgrokClientError)(error) && error.body.error_code === 103) {\n",
  "            var _error_body;\n            if ((0, _NgrokResolver.isNgrokClientError)(error) && ((_error_body = error == null ? void 0 : error.body) == null ? void 0 : _error_body.error_code) === 103) {\n",
);

fs.writeFileSync(target, source);
