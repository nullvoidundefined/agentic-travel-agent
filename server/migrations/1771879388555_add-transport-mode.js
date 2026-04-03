export const up = (pgm) => {
  pgm.addColumns('trips', {
    transport_mode: {
      type: 'varchar(10)',
      default: null,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('trips', ['transport_mode']);
};
