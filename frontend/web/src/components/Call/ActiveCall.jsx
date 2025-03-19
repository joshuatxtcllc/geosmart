import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  endCall, 
  toggleMute, 
  toggleHold, 
  startRecording, 
  stopRecording,
  transferCall 
} from '../../redux/slices/callSlice';
import {
  phoneNumberFormat,
  formatCallDuration
} from '../../utils/formatters';
import CallNotes from './CallNotes';
import TransferModal from './TransferModal';
import { useToast } from '../../hooks/useToast';

/**
 * ActiveCall Component
 * Displays the active call interface
 */
const ActiveCall = ({ call }) => {
  const dispatch = useDispatch();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [duration, setDuration] = useState(0);
  const [durationTimer, setDurationTimer] = useState(null);
  const { showToast } = useToast();
  
  // Get current user info
  const { currentUser } = useSelector(state => state.auth);
  
  // Start call timer
  useEffect(() => {
    if (call.status === 'in-progress') {
      const startTime = new Date(call.connectedAt || Date.now()).getTime();
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
      }, 1000);
      
      setDurationTimer(timer);
      
      return () => clearInterval(timer);
    } else if (durationTimer) {
      clearInterval(durationTimer);
    }
  }, [call.status, call.connectedAt]);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (durationTimer) {
        clearInterval(durationTimer);
      }
    };
  }, [durationTimer]);
  
  // Handle call actions
  const handleEndCall = () => {
    dispatch(endCall(call.id))
      .then(() => {
        showToast({
          type: 'success',
          message: 'Call ended successfully'
        });
      })
      .catch(error => {
        showToast({
          type: 'error',
          message: `Failed to end call: ${error.message}`
        });
      });
  };
  
  const handleToggleMute = () => {
    dispatch(toggleMute(call.id, !call.isMuted));
  };
  
  const handleToggleHold = () => {
    dispatch(toggleHold(call.id, !call.isOnHold));
  };
  
  const handleToggleRecording = () => {
    if (call.isRecording) {
      dispatch(stopRecording(call.id));
    } else {
      dispatch(startRecording(call.id));
    }
  };
  
  const handleTransferClick = () => {
    setShowTransferModal(true);
  };
  
  const handleTransferCall = (transferTo) => {
    dispatch(transferCall(call.id, transferTo))
      .then(() => {
        setShowTransferModal(false);
        showToast({
          type: 'success',
          message: 'Call transferred successfully'
        });
      })
      .catch(error => {
        showToast({
          type: 'error',
          message: `Failed to transfer call: ${error.message}`
        });
      });
  };
  
  // Determine call status display
  const getStatusDisplay = () => {
    switch (call.status) {
      case 'ringing':
        return 'Ringing...';
      case 'in-progress':
        return formatCallDuration(duration);
      case 'on-hold':
        return 'On Hold';
      default:
        return call.status;
    }
  };
  
  // Determine call direction icon
  const getDirectionIcon = () => {
    if (call.direction === 'inbound') {
      return <i className="fas fa-phone-alt text-green-500 transform rotate-90"></i>;
    } else {
      return <i className="fas fa-phone-alt text-blue-500"></i>;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center">
          {getDirectionIcon()}
          <span className="ml-2 text-sm text-gray-500">
            {call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}
          </span>
        </div>
        
        <h2 className="text-2xl font-bold mt-2">
          {call.contactName || 'Unknown Caller'}
        </h2>
        
        <p className="text-gray-600">
          {phoneNumberFormat(call.direction === 'inbound' ? call.from : call.to)}
        </p>
        
        <div className="mt-4 text-xl font-medium">
          {getStatusDisplay()}
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
            call.isMuted ? 'bg-red-100 border-red-300' : 'bg-gray-100 border-gray-300'
          }`}
          onClick={handleToggleMute}
        >
          <i className={`fas ${call.isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-xl mb-2`}></i>
          <span className="text-sm">{call.isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
            call.isOnHold ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'
          }`}
          onClick={handleToggleHold}
        >
          <i className={`fas ${call.isOnHold ? 'fa-play' : 'fa-pause'} text-xl mb-2`}></i>
          <span className="text-sm">{call.isOnHold ? 'Resume' : 'Hold'}</span>
        </button>
        
        <button
          className="flex flex-col items-center justify-center p-4 rounded-lg border bg-gray-100 border-gray-300"
          onClick={handleTransferClick}
        >
          <i className="fas fa-random text-xl mb-2"></i>
          <span className="text-sm">Transfer</span>
        </button>
        
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
            call.isRecording ? 'bg-red-100 border-red-300' : 'bg-gray-100 border-gray-300'
          }`}
          onClick={handleToggleRecording}
        >
          <i className="fas fa-record-vinyl text-xl mb-2"></i>
          <span className="text-sm">{call.isRecording ? 'Stop Rec' : 'Record'}</span>
        </button>
      </div>
      
      <div className="flex justify-center mb-8">
        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full flex items-center"
          onClick={handleEndCall}
        >
          <i className="fas fa-phone-slash mr-2"></i>
          End Call
        </button>
      </div>
      
      <CallNotes call={call} />
      
      {showTransferModal && (
        <TransferModal
          onClose={() => setShowTransferModal(false)}
          onTransfer={handleTransferCall}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default ActiveCall;
