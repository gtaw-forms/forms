import React from 'react';

const DevTest = ({ onFormChange }) => {
    const handleChange = (e) => {
        onFormChange(e.target.name, e.target.value);
    };

    return (
        <div>
            <input type="text" name="test_field_1" onChange={handleChange} placeholder="Test Field 1" />
            <input type="text" name="test_field_2" onChange={handleChange} placeholder="Test Field 2" />
        </div>
    );
};

export default DevTest;