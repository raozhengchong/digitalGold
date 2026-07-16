// External packages
import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Row,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

// Google Font API is used to load the Mona Sans font
// You can find other variants here: https://webfonts.googleapis.com/v1/webfonts?capability=WOFF2&family=Mona%20Sans&subset=latin-ext&key=[YOUR_API_KEY]

export type EmailLayoutProps = {
  siteTitle?: string;
  companyName?: string;
  footerLinks?: {
    url: string;
    label: string;
  }[];
};

export default function EmailLayout(
  props: {
    children: React.ReactNode;
  } & EmailLayoutProps
) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99Y41P6zHtY.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0kIpQmx24alC5A4PNr4C5OaxRsfNNlKbCePevHtVtX57DGjDU1QDce6VLYyWtY1rI.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="italic"
        />
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAjBN9Y41P6zHtY.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0kIpQmx24alC5A4PNr4C5OaxRsfNNlKbCePevHtVtX57DGjDU1QOkZ6VLYyWtY1rI.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="italic"
        />
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAaBN9Y41P6zHtY.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Mona Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/monasans/v1/o-0kIpQmx24alC5A4PNr4C5OaxRsfNNlKbCePevHtVtX57DGjDU1QNAZ6VLYyWtY1rI.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="italic"
        />
      </Head>
      <Tailwind
        config={{
          theme: {
            fontFamily: {
              sans: 'Mona Sans',
            },
            extend: {
              spacing: {
                18: '4.5rem',
                22: '5.5rem',
              },
              colors: {
                grayscale: {
                  500: '#808080',
                  200: '#D1D1D1',
                  100: '#E7E7E7',
                  50: '#F4F4F4',
                },
              },
              borderRadius: {
                xs: '4px',
                sm: '16px',
              },
              maxWidth: {
                37: '9.25rem',
                228: '57rem',
              },
              fontSize: {
                '3xl': ['3.5rem', '1.5'],
                '2xl': ['3rem', '1.5'],
                xl: ['2.5rem', '1.5'],
                lg: ['1.75rem', '1.5'],
                md: ['1.5rem', '1.5'],
                sm: ['1.125rem', '1.5'],
                base: ['1rem', '1.5'],
                xs: ['0.75rem', '1.5'],
              },
            },
          },
        }}
      >
        <Body className="bg-grayscale-50 font-normal">
          <Container className="bg-white py-18 px-22 rounded-sm max-w-228 w-full">
            <Link
              href={process.env.STOREFRONT_URL || 'http://localhost:8000'}
              className="text-lg mb-18 inline-block text-black"
            >
              {props.siteTitle || 'SofaSocietyCo.'}
            </Link>
            {props.children}
            <Hr className="mt-20 mb-8" />
            <Section className="gap-4 text-grayscale-500">
              <Row>
                <Column className="w-full">
                  <Link
                    href={process.env.STOREFRONT_URL || 'http://localhost:8000'}
                    className="text-lg text-grayscale-500"
                  >
                    {props.siteTitle || 'SofaSocietyCo.'}
                  </Link>
                  <Text className="text-xs m-0">
                    &copy; {new Date().getFullYear()},{' '}
                    {props.companyName || 'Sofa Society'}
                  </Text>
                </Column>
                {props.footerLinks && props.footerLinks.length > 0 && (
                  <Column valign="top">
                    <Row>
                      {props.footerLinks.map((link, index) => (
                        <Column className="px-2" key={index}>
                          <Link href={link.url} className="text-grayscale-500">
                            {link.label}
                          </Link>
                        </Column>
                      ))}
                    </Row>
                  </Column>
                )}
              </Row>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
