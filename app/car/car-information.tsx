import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

interface CarInformationFeaturesProps {
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly passengerCapacity: number;
}

export function CarInformationFeatures({
  make,
  model,
  year,
  passengerCapacity,
}: CarInformationFeaturesProps) {
  const seatingLabel = `${passengerCapacity}-seater`;

  return (
    <div className="px-4 lg:px-0">
      <Accordion type="single" collapsible className="w-full lg:hidden">
        <AccordionItem value="car-details" className="border-none">
          <AccordionTrigger className="text-sm font-semibold leading-7 text-gray-900 border-none py-2">
            Car information and features
          </AccordionTrigger>
          <AccordionContent className="border-none px-4">
            <dl className="mt-1 text-sm">
              <div className="py-2">
                <dt className="font-medium text-gray-900">Make &amp; Model</dt>
                <dd className="mt-0.5 text-gray-700">
                  {make} {model} {year}
                </dd>
              </div>
              <div className="py-2">
                <dt className="font-medium text-gray-900">Features</dt>
                <dd className="mt-0.5 text-gray-700">
                  Air conditioning, GPS, Bluetooth, Cruise control, Rear-view camera, USB
                </dd>
              </div>
              <div className="py-2">
                <dt className="font-medium text-gray-900">Transmission</dt>
                <dd className="mt-0.5 text-gray-700">Automatic</dd>
              </div>
              <div className="py-2">
                <dt className="font-medium text-gray-900">Seating</dt>
                <dd className="mt-0.5 text-gray-700">{seatingLabel}</dd>
              </div>
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="hidden lg:block">
        <h3 className="text-base font-semibold leading-7 text-gray-900">
          Car information and features
        </h3>
        <div className="mt-4 border-t border-gray-100">
          <dl>
            <div className="py-2 grid grid-cols-3 gap-4 px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Make &amp; Model</dt>
              <dd className="text-sm leading-6 text-gray-700 col-span-2">
                {make} {model} {year}
              </dd>
            </div>
            <div className="py-2 grid grid-cols-3 gap-4 px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
              <dd className="text-sm leading-6 text-gray-700 col-span-2">
                Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise control,
                Rear-view camera, USB ports
              </dd>
            </div>
            <div className="py-2 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium leading-6 text-gray-900">Transmission Type</dt>
              <dd className="text-sm leading-6 text-gray-700 col-span-2">Automatic</dd>
            </div>
            <div className="py-2 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium leading-6 text-gray-900">Seating Capacity</dt>
              <dd className="text-sm leading-6 text-gray-700 col-span-2">{seatingLabel}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
