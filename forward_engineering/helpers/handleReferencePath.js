const handleReferencePath = (externalDefinitions, { $ref: ref }) => {
	if (ref.startsWith('#')) {
		return { $ref: ref.replace('#model/', '#/') };
	}

	const [ pathToFile, relativePath] = ref.split('#/');
	if (!relativePath) {
		return { $ref: ref };
	}

	const externalDefinition = findExternalDefinition(externalDefinitions, pathToFile, relativePath);
	if (!externalDefinition) {
		return { $ref: ref };
	}

	if (externalDefinition.fileType === 'targetSchema') {
		return { $ref: updateSwaggerPath(pathToFile, relativePath) };
	} else if (externalDefinition.fileType === 'hackoladeSchema') {
		return externalDefinition;
	}

	return  { $ref: ref };
};

const findExternalDefinition = (externalDefinitions, pathToFile, relativePath) => {
	pathToFile = pathToFile.replace('file://', '');

	const definitionName = Object.keys(externalDefinitions).find(name => {
		const definition = externalDefinitions[name];
		return (
			definition.fieldRelativePath === '#/' + relativePath && 
			definition.link === pathToFile
		);
	});

	return externalDefinitions[definitionName];
};


const updateSwaggerPath = (pathToFile, relativePath) => {
	const hasResponse = relativePath.split('/')[2] !== 'properties';
	const path = relativePath.split('/');
	if (path[0] === 'definitions') {
		return `${pathToFile}#/definitions/${path.slice(2).join('/')}`;
	}

	const schemaIndex = path.indexOf('schema');
	const schemaPath = schemaIndex === -1 ? [] : path.slice(schemaIndex);
	const pathWithoutSlashes = path.slice(0, schemaIndex).filter(item => item !== 'properties');

	const bucketWithRequest = pathWithoutSlashes.slice(0, 2);

	if (!hasResponse) {
		debugger;
		const pathToParameter = [ ...bucketWithRequest, 'parameters', '0' ];
		const parameterSchemaPath = pathWithoutSlashes.slice(4);
		return `${pathToFile}#/paths/${[ ...pathToParameter, ...parameterSchemaPath, ...schemaPath].join('/')}`;
	}

	const response = pathWithoutSlashes[2];
	const hasHeaders = pathWithoutSlashes[3] === 'headers';
	
	const pathToItem = hasHeaders ? pathWithoutSlashes.slice(3) : pathWithoutSlashes.slice(4);

	const pathWithResponses = [ ...bucketWithRequest, 'responses', response, ...pathToItem, ...schemaPath ];

	return `${pathToFile}#/paths/${pathWithResponses.join('/')}`;
};

module.exports = handleReferencePath;
