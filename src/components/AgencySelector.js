import React from 'react';
import Civilian from '../assets/Civilian.png';
import application from '../assets/application.png';
import emergency from '../assets/emergency.png';
import empathy from '../assets/empathy.png';
import paperwork from '../assets/paperwork.png';
import psychology from '../assets/psychology.png';
import nurse from '../assets/nurse.png';
import email from '../assets/email.png';
import surgeon from '../assets/surgeon.png';

const AgencySelector = ({ showAgencySelector, setShowAgencySelector, handleAgencySelect, isMobile, hideAgencySelector, setHideAgencySelector }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 modal-overlay">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white agency-selector-modal">
                <div className="mt-3 text-center">
                    <div className="modal-header flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold">Form Selection</h4>
                        <button
                            className="close-button bg-transparent border-0 text-gray-500 hover:text-gray-700 focus:outline-none"
                            onClick={() => setShowAgencySelector(false)}
                            aria-label="Close selector"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    {isMobile ? (
                        <select
                            className="form-select appearance-none block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding bg-no-repeat border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                            onChange={(e) => {
                                handleAgencySelect(parseInt(e.target.value));
                            }}
                        >
                            <option value="">Select a form</option>
                            <option value="24">[Civilian] Medical Release Form </option>
                            <option value="25">[Civilian] Patient File - Basic </option>
                            <option value="3">[Civilian] Patient File - Advanced </option>
                            <option value="1">Forensic Services</option>
                            <option value="19">ER Protocol</option>
                            <option value="20">General Consultation</option>
                            <option value="22">Commentary Notes</option>
                            <option value="14">Mental Health</option>
                            <option value="6">Physical Evaluation</option>
                            <option value="27">Email Forms</option>
                            <option value="5">Surgical Ops</option>
                            <option value="28">Psychological Evaluation- WIP</option>
                        </select>
                    ) : (
                        <div className="agency-selector-buttons">
                            <div className="agency-row flex flex-wrap justify-center">
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(24)}
                                >
                                    <img src={Civilian} className="Center h-16 w-16 object-contain" alt="Civilian" />
                                    <span>[Civilian] Medical Release Form</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(25)}
                                >
                                    <img src={Civilian} className="Center h-16 w-16 object-contain" alt="Civilian" />
                                    <span>[Civilian] Patient File - Basic</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(3)}
                                >
                                    <img src={Civilian} className="Center h-16 w-16 object-contain" alt="Civilian" />
                                    <span>[Civilian] Patient File - Advanced</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(1)}
                                >
                                    <img src={application} className="Center h-16 w-16 object-contain" alt="Forensic" />
                                    <span>Forensic Services</span>
                                </button>
                            </div>
                            <div className="agency-row flex flex-wrap justify-center">
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(19)}
                                >
                                    <img src={emergency} className="Center h-16 w-16 object-contain" alt="Emergency" />
                                    <span>ER Protocol</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(20)}
                                >
                                    <img src={empathy} className="Center h-16 w-16 object-contain" alt="Consultation" />
                                    <span>General Consultation</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(22)}
                                >
                                    <img src={paperwork} className="Center h-16 w-16 object-contain" alt="Notes" />
                                    <span>Commentary Notes</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(14)}
                                >
                                    <img src={psychology} className="Center h-16 w-16 object-contain" alt="Mental Health" />
                                    <span>Mental Health</span>
                                </button>
                            </div>
                            <div className="agency-row flex flex-wrap justify-center">
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(6)}
                                >
                                    <img src={nurse} className="Center h-16 w-16 object-contain" alt="Evaluation" />
                                    <span>Physical Evaluation</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(27)}
                                >
                                    <img src={email} className="Center h-16 w-16 object-contain" alt="Email" />
                                    <span>Email Forms</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(5)}
                                >
                                    <img src={surgeon} className="Center h-16 w-16 object-contain" alt="Surgery" />
                                    <span>Surgical Ops</span>
                                </button>
                                <button
                                    className="agency-select-button m-2 p-2 rounded-md shadow-sm bg-white hover:bg-gray-100 flex flex-col items-center"
                                    onClick={() => handleAgencySelect(28)}
                                >
                                    <img src={psychology} className="Center h-16 w-16 object-contain" alt="Psychology" />
                                    <span>Psychological Evaluation</span>
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="hide-selector-option mt-4">
                        <input
                            type="checkbox"
                            id="hideSelector"
                            className="mr-2 leading-tight"
                            checked={hideAgencySelector}
                            onChange={(e) => {
                                setHideAgencySelector(e.target.checked);
                                setShowAgencySelector(!e.target.checked); // Close the selector when checked
                            }}
                        />
                        <label htmlFor="hideSelector" className="text-sm">Don't show this popup again</label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgencySelector;