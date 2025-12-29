import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect } from 'react';
import { database, functions } from '../../firebase';
import { ref, onValue, set, push, remove, update, get } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { Button, Table, Badge, Spinner, Alert, Form, Card, Modal } from 'react-bootstrap';

const UntrackedLocationManager = ({ showNotification }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const [untrackedLogs, setUntrackedLogs] = useState([]);
    const [locationData, setLocationData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedRegionType, setSelectedRegionType] = useState('los_santos_city');
    const [selectedAreaIndex, setSelectedAreaIndex] = useState('');
    const [newAreaName, setNewAreaName] = useState('');
    const [isAddingNewArea, setIsAddingNewArea] = useState(false);

    useEffect(() => {
        const untrackedRef = ref(database, 'untracked_locations_log');
        const locationsRef = ref(database, 'locationData');

        const unsubscribeUntracked = onValue(untrackedRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const logs = Object.entries(data).map(([key, value]) => ({
                    key,
                    ...value
                }));
                setUntrackedLogs(logs.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setUntrackedLogs([]);
            }
        });

        const unsubscribeLocations = onValue(locationsRef, (snapshot) => {
            setLocationData(snapshot.val());
            setIsLoading(false);
        });

        return () => {
            unsubscribeUntracked();
            unsubscribeLocations();
        };
    }, []);

    const handleScanLocations = async () => {
        setIsScanning(true);
        showNotification("Scanning reports for unknown locations...", "info");
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Scanned for Untracked Locations',
                'Triggered the scan for untracked locations in reports.',
                'Untracked Location Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const scanFunc = httpsCallable(functions, 'scanUntrackedLocations');
            const result = await scanFunc();
            if (result.data.success) {
                showNotification(result.data.message, "success");
            } else {
                showNotification(result.data.message || "Scan failed.", "error");
            }
        } catch (error) {
            console.error("Scan error:", error);
            showNotification("Error scanning locations.", "error");
        } finally {
            setIsScanning(false);
        }
    };

    const handleInitializeData = async () => {
        if (!window.confirm("Initialize location data from hardcoded list? This will overwrite existing data and rename Blaine County to Los Santos County.")) return;
        
        setIsProcessing(true);
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Initialized Location Data',
                'Initialized location data from the hardcoded list.',
                'Untracked Location Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const initialData = {
                "los_santos_city": [
                    { "area": "Hawick", "streets": ["Hawick Avenue", "Alta Street", "Power Street", "Meteor Street", "Spanish Avenue"] },
                    { "area": "Vinewood", "streets": ["Vinewood Boulevard", "Clinton Avenue", "Fenwell Place", "Mirror Park Boulevard", "Elgin Avenue"] },
                    { "area": "Downtown", "streets": ["San Andreas Avenue", "Vespucci Boulevard", "Swiss Street", "Peaceful Street", "Sinner Street"] },
                    { "area": "South Los Santos", "streets": ["Strawberry Avenue", "Carson Avenue", "Forum Drive", "Innocence Boulevard", "Brouge Avenue", "Grove Street"] },
                    { "area": "Mirror Park", "streets": ["Bridge Street", "Mirror Park Boulevard", "York Street", "Tangerine Street", "Nikola Avenue", "East Mirror Drive", "Mirror Place"] },
                    { "area": "Rockford Hills", "streets": ["Dorset Drive", "Abe Milton Parkway", "South Rockford Drive", "Heritage Way", "Mad Wayne Thunder Drive"] },
                    { "area": "Del Perro", "streets": ["Del Perro Boulevard", "Prosperity Street", "Sandcastle Way", "Red Desert Avenue"] },
                    { "area": "Vespucci", "streets": ["Aguja Street", "Bay City Avenue", "Goma Street", "Melanoma Street", "Palomino Avenue"] },
                    { "area": "La Mesa", "streets": ["Popular Street", "Orchardville Avenue", "El Rancho Boulevard", "Capital Boulevard"] }
                ],
                "los_santos_county": [
                    { 
                        "area": "Los Santos County", 
                        "streets": [
                            "Algonquin Boulevard", "Joshua Road", "Zancudo Avenue", "Panorama Drive", "Mountain View Drive", "Cholla Springs Avenue",
                            "Grapeseed Main Street", "Grapeseed Avenue", "Joad Lane", "O'Neil Way", "Union Road",
                            "Paleto Boulevard", "Procopio Drive", "Cascade Drive", "Duesenberry Lane", "Pyrite Avenue",
                            "Route 68", "Meringue Lane", "Cat-Claw Avenue",
                            "Great Ocean Highway", "Barbaree Lane", "Ineseno Road"
                        ] 
                    }
                ],
                "major_highways": [
                    "Senora Freeway", "Los Santos Freeway", "Del Perro Freeway", "Great Ocean Highway", "Olympic Freeway", "La Puerta Freeway"
                ]
            };
            await set(ref(database, 'locationData'), initialData);
            showNotification("Location data initialized successfully.", "success");
        } catch (error) {
            console.error("Initialization error:", error);
            showNotification("Failed to initialize location data.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenAddModal = (log) => {
        setSelectedLog(log);
        setShowAddModal(true);
        setSelectedAreaIndex('');
        setNewAreaName('');
        setIsAddingNewArea(false);
    };

    const handleAddToRegion = async () => {
        if (!selectedLog) return;
        setIsProcessing(true);

        try {
            const { userAgent, timeZone } = getUserContext();
            const streetToAdd = selectedLog.place;
            const areaName = isAddingNewArea ? newAreaName.trim() : locationData[selectedRegionType][selectedAreaIndex].area;
            logAdminAction(
                gtawUsername,
                'Added Untracked Location to Region',
                `Street: ${streetToAdd}\nRegion: ${selectedRegionType}\nArea: ${areaName}`,
                'Untracked Location Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            const updatedData = { ...locationData };

            if (isAddingNewArea) {
                if (!newAreaName.trim()) throw new Error("Area name is required.");
                updatedData[selectedRegionType].push({
                    area: newAreaName.trim(),
                    streets: [streetToAdd]
                });
            } else {
                if (selectedAreaIndex === '') throw new Error("Please select an area.");
                const area = updatedData[selectedRegionType][selectedAreaIndex];
                if (!area.streets.includes(streetToAdd)) {
                    area.streets.push(streetToAdd);
                }
            }

            await set(ref(database, 'locationData'), updatedData);
            await remove(ref(database, `untracked_locations_log/${selectedLog.key}`));
            
            showNotification(`Added '${streetToAdd}' to ${areaName}`, "success");
            setShowAddModal(false);
        } catch (error) {
            console.error("Error adding to region:", error);
            showNotification(error.message || "Failed to add to region.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteLog = async (key) => {
        if (!window.confirm("Delete this untracked location log?")) return;
        try {
            const logToDelete = untrackedLogs.find(log => log.key === key);
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Deleted Untracked Location Log',
                `Log Key: ${key}\nPlace: ${logToDelete?.place}`,
                'Untracked Location Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            await remove(ref(database, `untracked_locations_log/${key}`));
            showNotification("Log deleted.", "success");
        } catch (error) {
            showNotification("Failed to delete log.", "error");
        }
    };

    const handlePurgeLogs = async () => {
        if (!window.confirm("Are you sure you want to PURGE ALL untracked location logs? This cannot be undone.")) return;
        setIsProcessing(true);
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Purged All Untracked Location Logs',
                'All untracked location logs have been purged.',
                'Untracked Location Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            await remove(ref(database, 'untracked_locations_log'));
            showNotification("All untracked logs purged.", "success");
        } catch (error) {
            console.error("Purge error:", error);
            showNotification("Failed to purge logs.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <div className="untracked-location-manager">
            <Card className="mb-4">
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0"><i className="fas fa-map-marker-alt me-2"></i>Untracked Locations</h5>
                    <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={handleScanLocations} disabled={isScanning}>
                            {isScanning ? <Spinner size="sm" /> : <><i className="fas fa-search me-1"></i> Check for New Locations</>}
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={handlePurgeLogs} disabled={isProcessing || untrackedLogs.length === 0}>
                            <i className="fas fa-eraser me-1"></i> Purge All Logs
                        </Button>
                        {!locationData && (
                            <Button variant="warning" size="sm" onClick={handleInitializeData} disabled={isProcessing}>
                                {isProcessing ? <Spinner size="sm" /> : "Initialize Location Data"}
                            </Button>
                        )}
                    </div>
                </Card.Header>
                <Card.Body>
                    {untrackedLogs.length === 0 ? (
                        <Alert variant="info">No untracked locations reported recently.</Alert>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead>
                                <tr>
                                    <th>Place / Street</th>
                                    <th>Source Report</th>
                                    <th>Detected At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {untrackedLogs.map((log) => (
                                    <tr key={log.key}>
                                        <td>
                                            <strong>{log.place}</strong>
                                        </td>
                                        <td>
                                            {log.lastReportKey ? (
                                                <small className="text-muted font-monospace">{log.lastReportKey}</small>
                                            ) : (
                                                <span className="text-muted italic">N/A</span>
                                            )}
                                        </td>
                                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                                        <td>
                                            <Button variant="primary" size="sm" className="me-2" onClick={() => handleOpenAddModal(log)}>
                                                Add to Region
                                            </Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteLog(log.key)}>
                                                <i className="fas fa-trash"></i>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add to Region</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Adding: <strong>{selectedLog?.place}</strong></p>
                    <Form.Group className="mb-3">
                        <Form.Label>Region Type</Form.Label>
                        <Form.Select 
                            value={selectedRegionType} 
                            onChange={(e) => {
                                setSelectedRegionType(e.target.value);
                                setSelectedAreaIndex('');
                            }}
                        >
                            <option value="los_santos_city">Los Santos City</option>
                            <option value="los_santos_county">Los Santos County</option>
                        </Form.Select>
                    </Form.Group>

                    <Form.Check 
                        type="switch"
                        id="new-area-switch"
                        label="Create New Area"
                        className="mb-3"
                        checked={isAddingNewArea}
                        onChange={(e) => setIsAddingNewArea(e.target.checked)}
                    />

                    {isAddingNewArea ? (
                        <Form.Group className="mb-3">
                            <Form.Label>New Area Name</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={newAreaName} 
                                onChange={(e) => setNewAreaName(e.target.value)}
                                placeholder="e.g. Mirror Park"
                            />
                        </Form.Group>
                    ) : (
                        <Form.Group className="mb-3">
                            <Form.Label>Select Existing Area</Form.Label>
                            <Form.Select 
                                value={selectedAreaIndex} 
                                onChange={(e) => setSelectedAreaIndex(e.target.value)}
                            >
                                <option value="">-- Select Area --</option>
                                {locationData && locationData[selectedRegionType]?.map((area, idx) => (
                                    <option key={idx} value={idx}>{area.area}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleAddToRegion} disabled={isProcessing}>
                        {isProcessing ? <Spinner size="sm" /> : "Confirm Add"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default UntrackedLocationManager;
