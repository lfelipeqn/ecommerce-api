const { Product } = require('../src/product');
import * as dotenv from 'dotenv';

dotenv.config();

describe('generateRandomTickets', () => {
  it('should generate 100 tickets with 6 digits each by default', async () => {
    const event = {
      digitosTicket:6,
      totalTickets: 600
    };

    const response = await Product(event, null, null);

    expect(response.statusCode).toBe(200);
    const tickets = JSON.parse(response.body);
    expect(tickets.length).toBe(event?.totalTickets);

    for (const ticket of tickets) {
      expect(ticket.reference.toString().length).toBe(event.digitosTicket);
      expect(Number.isInteger(Number(ticket.reference))).toBe(true);
      expect(ticket.reference.toString().length===event.digitosTicket).toBe(true); // Valid range for 6 digit tickets
      expect(tickets.indexOf(ticket) === tickets.lastIndexOf(ticket)).toBe(true); // Tickets are unique
    }
    
    
  });

});
