const RSVPConfirmation = ({ name, table, tableDescription }) => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
      <h2 className="text-2xl font-bold text-green-700 mb-2">RSVP Confirmed!</h2>
      <p className="text-gray-700 mb-4">
        Thank you, <span className="font-semibold">{name}</span>! 
        We're excited to have you join us.
      </p>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <p className="text-gray-600">You have been assigned to:</p>
        <p className="text-2xl font-bold text-indigo-600 mt-2">Table {table}</p>
        <p className="text-sm text-gray-500 mt-1">({tableDescription})</p>
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Please arrive 15 minutes before the dinner starts. We look forward to seeing you!
      </p>
    </div>
  );
};

export default RSVPConfirmation; 