const getExtensions = require('./extensionsHelper');

function getInfo(data) {
	const info = {
		description: data.description || "",
		title: data.title || "",
		termsOfService: data.termsOfService || "",
		contact: getContact(data.contact),
		license: getLicense(data.license),
		version: data.modelVersion || ""
	};
	const extensions = getExtensions(data.infoExtensions);
	return Object.assign({}, info, extensions);
}

function getContact(contacts) {
	if (!contacts || contacts.length === 0) {
		return null;
	}

	return Object.assign({}, {
		name: contacts[0].contactName,
		url: contacts[0].contactURL,
		email: contacts[0].contactemail
	}, getExtensions(contacts[0].contactExtensions));
}

function getLicense(license) {
	if (!license || license.length === 0) {
		return null;
	}

	return Object.assign({}, {
		name: license[0].licenseName,
		url: license[0].licenseURL
	}, getExtensions(license[0].contactExtensions));
}

module.exports = getInfo;
