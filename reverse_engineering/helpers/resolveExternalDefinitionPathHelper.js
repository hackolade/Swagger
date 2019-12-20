const dataHelper = require('./dataHelper');
const commonHelper = require('./commonHelper');
const get = require('lodash.get'); 

const resolvePath = (data, callback) => {
	let path = (data.path || '').split('/');
	if (!path[0]) {
		path = path.slice(1);
	}
	if (path[0] === 'definitions') {
		return callback(null, addPropertiesToPath(path));
	}

	const bucketName = path[1];
	const requestName = path[2];

	if (path[3] === 'responses') {
		const responseName = path[4];

		if (path[5] === 'headers') {
			return callback(`${bucketName}/${requestName}/${responseName}${addPropertiesToPath(path.slice(4))}`);
		}
		return callback(`${bucketName}/${requestName}/${responseName}/properties/body${addPropertiesToPath(path.slice(4))}`);
	}

	const parameterIndex = path[4];

    try {
		const { extension } = commonHelper.getPathData(data.content, '');
        const swaggerSchema = dataHelper.getSwaggerJsonSchema(data.content, '', extension);

		const parameter = get(
			swaggerSchema,
			['paths', restoreSlashes(bucketName), restoreSlashes(requestName), 'parameters', parameterIndex],
			{}
		);
		const paramIn = parameter.in || 'path';

		return callback(null, `${bucketName}/${requestName}/properties/${paramIn}/properties/${parameter.name}${addPropertiesToPath(path.slice(5))}`);
	} catch (err) {
		callback(err, data.path || '');
	}
};

const addPropertiesToPath = path => path.length ? '/properties/' + path.join('/properties/') : '';

const restoreSlashes = (str = '') => str.replace(/%2F/g, '/');

module.exports = {
	resolvePath
};
