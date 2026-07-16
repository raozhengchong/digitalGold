// External packages
import { Text, Heading, Row, Column } from '@react-email/components';
import { CustomerDTO } from '@medusajs/framework/types';

// Components
import EmailLayout, { EmailLayoutProps } from './components/EmailLayout';

const UnorderedList: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <Row className={['align-top', className].filter(Boolean).join(' ')}>
      <Column className="pl-6">{children}</Column>
    </Row>
  );
};

const UnorderedListItem: React.FC<{
  children?: React.ReactNode;
  className?: string;
  textClassName?: string;
}> = ({ children, className, textClassName }) => {
  return (
    <ul
      role="presentation"
      className={['list-disc mt-0 mb-0 p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      <li role="listitem" className="m-0 p-0">
        <span className={textClassName}>{children}</span>
      </li>
    </ul>
  );
};

type Props = {
  customer: Pick<CustomerDTO, 'id' | 'email' | 'first_name' | 'last_name'>;
};

export default function WelcomeEmail({
  customer,
  ...emailLayoutProps
}: Props & EmailLayoutProps) {
  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl mt-0 mb-10 font-medium">
        Welcome to Sofa Society!
      </Heading>
      <Text className="text-md !mb-8">
        Welcome to Sofa Society! We're excited to have you join our community of
        comfort enthusiasts. With our carefully crafted sofas, you&apos;re just
        steps away from adding elegance and coziness to your living space.
      </Text>
      <Text className="text-md font-semibold !mb-8">
        As a new member, here&apos;s what you can expect:
      </Text>
      <UnorderedList className="mb-8">
        <UnorderedListItem className="text-md">
          Premium, high-quality sofas in a range of styles and materials
        </UnorderedListItem>
        <UnorderedListItem className="text-md">
          Dedicated customer support ready to assist you
        </UnorderedListItem>
        <UnorderedListItem className="text-md">
          Exclusive offers and early access to new collections
        </UnorderedListItem>
        <UnorderedListItem className="text-md">
          Explore our collections and find the sofa that suits your style!
        </UnorderedListItem>
      </UnorderedList>
      <Text className="text-md">
        Best wishes,
        <br />
        The Sofa Society Team
      </Text>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  customer: {
    id: '1',
    email: 'example@medusa.local',
    first_name: 'John',
    last_name: 'Doe',
  },
} satisfies Props;
