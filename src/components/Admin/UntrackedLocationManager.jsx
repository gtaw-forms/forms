import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect } from 'react';
import { database, functions } from '../../firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { Button, Table, Spinner, Alert, Form, Card } from 'react-bootstrap';
import MapModal from '../Modals/MapModal';

const UntrackedLocationManager = ({ showNotification }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const [untrackedLogs, setUntrackedLogs] = useState([]);
    const [locationData, setLocationData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [showMapPicker, setShowMapMapPicker] = useState(false);
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

    const handleOpenMapPicker = (log) => {
        setSelectedLog(log);
        setShowMapMapPicker(true);
        setSelectedAreaIndex('');
        setNewAreaName('');
        setIsAddingNewArea(false);
    };

    const handleMapSelection = async (selection) => {
        if (!selectedLog) return;
        setIsProcessing(true);

        try {
            const { userAgent, timeZone } = getUserContext();
            const streetToAdd = selection.name; // Use name from map confirmation
            const areaName = isAddingNewArea ? newAreaName.trim() : locationData[selectedRegionType][selectedAreaIndex].area;
            
            logAdminAction(
                gtawUsername,
                'Mapped Untracked Location',
                `Street: ${streetToAdd}\nRegion: ${selectedRegionType}\nArea: ${areaName}\nCoords: ${selection.gameX}, ${selection.gameY}`,
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
                if (selectedAreaIndex === '') throw new Error("Please select an area first in the Region Config below.");
                const area = updatedData[selectedRegionType][selectedAreaIndex];
                if (!area.streets.includes(streetToAdd)) {
                    area.streets.push(streetToAdd);
                }
            }

            await set(ref(database, 'locationData'), updatedData);
            await remove(ref(database, `untracked_locations_log/${selectedLog.key}`));
            
            showNotification(`Successfully mapped '${streetToAdd}' to ${areaName}`, "success");
            setShowMapMapPicker(false);
        } catch (error) {
            console.error("Error adding to region:", error);
            showNotification(error.message || "Failed to add to region.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    // ... rest of the existing helper functions (handleScan, handleDelete, etc.)
    const handleScanLocations = async () => {
        setIsScanning(true);
        showNotification("Scanning reports for unknown locations...", "info");
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(gtawUsername, 'Scanned for Untracked Locations', 'Triggered the scan.', 'Untracked Location Manager', userAgent, timeZone, gtawUsername, gtawUser);
            const scanFunc = httpsCallable(functions, 'scanUntrackedLocations');
            const result = await scanFunc();
            showNotification(result.data.message, result.data.success ? "success" : "error");
        } catch (error) {
            showNotification("Error scanning locations.", "error");
        } finally {
            setIsScanning(false);
        }
    };

    const handleDeleteLog = async (key) => {
        if (!window.confirm("Delete this log?")) return;
        await remove(ref(database, `untracked_locations_log/${key}`));
        showNotification("Log deleted.", "success");
    };

    const handlePurgeLogs = async () => {
        if (!window.confirm("Purge ALL logs?")) return;
        await remove(ref(database, 'untracked_locations_log'));
        showNotification("All logs purged.", "success");
    };

    if (isLoading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <div className="untracked-location-manager">
            {/* Region Configuration Bar - Must select before mapping */}
            <Card className="mb-3 border-warning">
                <Card.Header className="bg-warning text-dark py-2">
                    <small className="fw-bold"><i className="fas fa-cog me-2"></i>STEP 1: REGION CONFIGURATION (Select where to add before clicking Map)</small>
                </Card.Header>
                <Card.Body className="py-2">
                    <div className="d-flex gap-3 align-items-end">
                        <Form.Group style={{ flex: 1 }}>
                            <Form.Label className="mb-0 small fw-bold">Region</Form.Label>
                            <Form.Select size="sm" value={selectedRegionType} onChange={(e) => setSelectedRegionType(e.target.value)}>
                                <option value="los_santos_city">Los Santos City</option>
                                <option value="los_santos_county">Los Santos County</option>
                            </Form.Select>
                        </Form.Group>

                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Form.Check type="switch" id="new-area-toggle" label="New Area" checked={isAddingNewArea} onChange={(e) => setIsAddingNewArea(e.target.checked)} />
                        </div>

                        {isAddingNewArea ? (
                            <Form.Group style={{ flex: 2 }}>
                                <Form.Label className="mb-0 small fw-bold">New Area Name</Form.Label>
                                <Form.Control size="sm" type="text" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="e.g. Mirror Park" />
                            </Form.Group>
                        ) : (
                            <Form.Group style={{ flex: 2 }}>
                                <Form.Label className="mb-0 small fw-bold">Target Area</Form.Label>
                                <Form.Select size="sm" value={selectedAreaIndex} onChange={(e) => setSelectedAreaIndex(e.target.value)}>
                                    <option value="">-- Select Area --</option>
                                    {locationData && locationData[selectedRegionType]?.map((area, idx) => (
                                        <option key={idx} value={idx}>{area.area}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        )}
                    </div>
                </Card.Body>
            </Card>

            <Card className="mb-4">
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0"><i className="fas fa-map-marker-alt me-2"></i>Untracked Locations</h5>
                    <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={handleScanLocations} disabled={isScanning}>
                            {isScanning ? <Spinner size="sm" /> : <><i className="fas fa-search me-1"></i> Check for New</>}
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={handlePurgeLogs}>
                            <i className="fas fa-eraser"></i>
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body>
                    {untrackedLogs.length === 0 ? (
                        <Alert variant="info">No untracked locations reported.</Alert>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead>
                                <tr>
                                    <th>Place / Street</th>
                                    <th>Source Report</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {untrackedLogs.map((log) => (
                                    <tr key={log.key}>
                                        <td><strong>{log.place}</strong></td>
                                        <td><small className="text-muted font-monospace">{log.lastReportKey || 'N/A'}</small></td>
                                        <td>
                                            <Button variant="primary" size="sm" className="me-2" onClick={() => handleOpenMapPicker(log)}>
                                                Map Location
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

            <MapModal 
                show={showMapPicker} 
                onHide={() => setShowMapMapPicker(false)}
                initialQuery={selectedLog?.place || ''}
                onSelect={handleMapSelection}
            />
        </div>
    );
};

export default UntrackedLocationManager;
