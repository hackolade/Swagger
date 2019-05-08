const getOpeningFileError = (error) => {
    return {
        title: 'Error opening file',
        error: error
    };
};

const getValidationError = (error) => {
    return {
        title: 'Error validating Swagger Schema',
        error
    };
};

const getParseError = (error) => {
    return {
        title: 'Error parsing Swagger Schema',
        error
    };
};

const getConvertError = (error) => {
    return {
        title: 'Error parsing Swagger Schema',
        error
    };
};

module.exports = {
    getOpeningFileError,
	getValidationError,
	getParseError,
    getConvertError
};