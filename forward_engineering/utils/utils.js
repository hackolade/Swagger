function removeEmptyObjectFields(inputObj, filtrationConfig = {}) {
	const obj = JSON.parse(JSON.stringify(inputObj));

	const isRequiredField = key => (filtrationConfig[key] && filtrationConfig[key].required) || (filtrationConfig.any && filtrationConfig.any.required);

	const isNotEmptyValue = key => obj[key] !== null && obj[key] !== undefined;
	const isNotEmptyArray = key => Array.isArray(obj[key]) ? obj[key].length > 0 : true;
	const isNotEmptyString = key => typeof obj[key] === 'string' ? obj[key].length > 0 : true;
	const isNotEmptyObject = key => isObjectAndNotArray(key) ? Object.keys(obj[key]).length > 0 : true;

	const isObjectAndNotArray = key => typeof obj[key] === 'object' && !Array.isArray(obj[key]);

	const getObjectProps = (key) => {
		if(filtrationConfig[key]) {
			return filtrationConfig[key].props;
		}
		if (filtrationConfig.any) {
			return filtrationConfig.any.props;
		}
	} 

	return Object.keys(obj)
		.filter(key => isRequiredField(key) || (isNotEmptyValue(key) && isNotEmptyArray(key) && isNotEmptyString(key) && isNotEmptyObject(key)))
		.reduce(
			(newObj, key) => {
				if (isObjectAndNotArray(key)) {
					return Object.assign(newObj, {
						[key]: removeEmptyObjectFields(obj[key], getObjectProps(key))
				  	});
				}
					return Object.assign(newObj, { [key]: obj[key] })
			},
			{}
		);
}

const prepareName = (name) => {
	return (name || '').replace(/\ /ig, '_');
};

const prepareReferenceName = (ref) => {
	const refParts = ref.split('/');
	const name = refParts.pop();
	const preparedName = prepareName(name);

	refParts.push(preparedName);

	return refParts.join('/');
};


module.exports = {
	removeEmptyObjectFields,
	prepareName,
	prepareReferenceName
};