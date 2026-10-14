import { markdownToHtml } from "../richText";

/* The saved legal copy Product Config's Legal tab opens on. Stored as the
   rich-text HTML its editor (`RichDocField`) works in; authored here as
   Markdown for readability and converted once: `##` section headings, numbered
   clauses as their own paragraphs, `###` sub-sections, **bold** run-in
   labels, one blank line between blocks (address lines break with a single
   newline), *italics*, links as [text](url). Both documents in English and
   Spanish. */

const TERMS_OF_SERVICE_MD = `5925 Almeda Road Unit 12018
Houston, TX 77004
Tel: (415) 707-8437
[www.skillcatapp.com](https://www.skillcatapp.com)

SkillCat, INC (“SkillCat”) is a registered company whose registered office is at 5925 Almeda Road, Unit 12018 Houston, TX 77004. SkillCat, INC (“SkillCat”) owns [www.skillcatapp.com](https://www.skillcatapp.com) and [www.skillcat.app](https://www.skillcat.app). The following terms and conditions (“TOS”) govern all use of the skillcatapp.com and skillcat.app websites (“Website”) and all content, services, and products available at or through the Website (“Services”). This is a contract with SkillCat, INC (“SkillCat”). Please carefully read the following terms before accessing this site or using a course.

By accessing the site (which includes, visiting, registering, purchasing or accessing a course) you accept and agree to all of the covenants and conditions imposed in this agreement. If you do not agree to these terms, you may not access the site. By using this service, you agree that you have read, understand, and agree to these terms. You also agree to review this Agreement periodically to be aware of modifications to the agreement, which modifications SkillCat, INC (“SkillCat”) may make at any time. Your continued use of this site will be deemed your conclusive acceptance of any modified agreement.

## 1) General

1.1) SkillCat, INC (“SkillCat”) reserves the right to change the content used at any time.

1.2) Students who enroll in a course have lifetime access to the certificates earned.

1.3) All rights not expressly granted herein are reserved.

1.4) These Terms and Conditions shall be governed by and construed in accordance with the laws of Houston, Texas, United States of America.

1.5) If you do not agree with these Terms and Conditions you must cease the course immediately and notify SkillCat, INC (“SkillCat”) of your intent not to continue.

## 2) Your SkillCat Account

2.1) A registered account (“Account”) is the area in our Website, which is accessible via a password and contains personal information regarding the user.

2.2) You are responsible for maintaining the security of your Account and fully responsible for all activities that occur under the account and any other actions taken in connection with the Account.

2.3) You must immediately notify SkillCat, INC (“SkillCat”) of any unauthorized uses of your Account or any other breaches of security.

2.4) SkillCat, INC (“SkillCat”) will not be liable for any acts or omissions by you, including any damages of any kind incurred as a result of such acts or omissions.

2.5) Registration of a user requires the user to provide a valid email address for the communication between eLearning Industry and the user along with a valid name, amongst other information required pursuant to Section 6.4.a below.

## 3) Cancellation Policy

3.1) If a student cannot access the course online via SkillCat.App because they fail to meet the required system requirements given on the website.

## 4) e-Learning Materials

4.1) The training material is property of SkillCat, INC (“SkillCat”)

4.2) This training material has been prepared, maintained, updated, and distributed by SkillCat, INC (“SkillCat”)

4.3) The use of the training material on our courses is restricted to the Registered User who has been supplied with the log-in details by a Training Services Provider as part of an authorized course.

4.4) The Registered User shall not copy, share, modify, transmit, distribute, or in any way, exploit the copyrighted materials provided by SkillCat, INC (“SkillCat”) other than for their own individual training. Use for any other purpose is expressly prohibited by law and any violators will be prosecuted.

4.5) The Registered User shall not permit anyone else to copy, use, modify, transmit, distribute, or in any way, exploit the copyrighted materials.

4.6) The materials made available by SkillCat, INC (“SkillCat”) are provided “as-is” without warranties of any kind, either expressed, or implied, including, but not limited to, all implied warranties of merchantability, fitness for a particular purpose, title or non-infringement.

4.7) SkillCat, INC (“SkillCat”) does not warrant that the materials will be error-free including technical inaccuracies, nor free of viruses, or other harmful matter. The entire cost of any necessary service, repair, or correction, is the Registered User’s responsibility.

4.8) SkillCat, INC (“SkillCat”) may make improvements, or changes, to this material at any time without prior notification.

4.9) All other trademarks, service marks, and trade names in this material are the marks of the respective owners and any unauthorized use is prohibited.

4.10) All rights not expressly granted herein are reserved.

4.11) These Terms and Conditions shall be governed by and construed in accordance with the laws of Houston, Texas. United States of America.

4.12) If you do not agree with these Terms and Conditions you must cease to use the e-learning immediately.

## 5) Access to the courses

5.1) SkillCat, INC (“SkillCat”) strives to provide the course content to its Students on a continuous basis. To that end, SkillCat, INC (“SkillCat”) will take all commercially reasonable efforts to provide uninterrupted Access of the courses to its students. However, from time to time, students may be unable to Access the courses due to conditions beyond SkillCat, INC (“SkillCat”) control. Such conditions include, but are not limited to force majeure, acts of God, power outages, and the acts of computer hackers and others acting outside the law. Also, from time to time, access may be unavailable due to software issues, server downtime, increased internet traffic or downtime, programming errors, regular maintenance of the system, and other related reasons. In response to any unavailability of the courses to its Students, SkillCat, INC (“SkillCat”) will take all commercially reasonable steps to ensure access is restored within a reasonable period of time. The term “commercially reasonable,” as used in these Terms, shall mean reasonable efforts taken in good faith without an unduly or burdensome use or expenditure of time, resources, personnel, or money.

5.2) SkillCat, INC (“SkillCat”) endeavors to provide the highest quality content to its Students. To that end, SkillCat, INC (“SkillCat”) reserves the right, in its sole discretion, to change, modify, or discontinue any aspect or feature of this Site in whole or in part, including, without limitation, the content, availability, Access and/or the Terms of this Site. Such changes, modifications, additions or deletions will be effective immediately upon notice thereof, which notice may be made by posting such changes on this Site.

5.3) Users are solely responsible for ensuring that they have sufficient and compatible hardware, software, telecommunications equipment, and Internet service necessary for use of the Site.

## 6) Registration/Sign-Up

6.1) Content published on SkillCat, INC (“SkillCat”) is accessible by all visitors. However, certain features and services may require registration. Users may register (“Create New Account”) on-site (for example, at https://skillcat.app/login/index.php?). Upon signing-up, an Account is created for the user. Users who sign-up on-site are required to confirm their registration by clicking on an activation link sent to them via email. All active user accounts have the capability to view course materials.

Users are required to provide part or all of the following information below:

1. First and last name
2. Email address
3. Company name, state, and country
4. Job title, focus, and level
5. Work phone
6. SkillCat, INC (“SkillCat”) reserves the right to reject any registration request at its sole discretion.

Once SkillCat, INC (“SkillCat”) receives your registration application, it will create an Account for you on our Website and will email you a link to activate your Account. Once you access the link, you will be asked to enter a password and accept these TOU. Once you complete activation, you will be able to create your profile (“Profile”).

Each Account is personal and non-transferable. Your rights and obligations to the eLearning Industry are also non-transferable. You are fully responsible for all activities that occur under this Account and any other actions taken in connection with this Account. You must immediately notify SkillCat, INC (“SkillCat”) at [info@skillcatapp.com](mailto:info@skillcatapp.com) regarding any unauthorized uses of your Account or any other breaches of security. SkillCat, INC (“SkillCat”) will not be liable for any acts or omissions by you, including any damages of any kind incurred as a result of such acts or omissions.

## 7) Third Party Content; Hyperlinks

7.1) SkillCat, INC (“SkillCat”) makes no warranty, either expressed or implied, of the accuracy, merchantability, fitness for a particular purpose, or non-infringement of the information provided by third parties. This includes, but is not limited to, any information found on a link located on this site that allows users to access information found on another site. Additionally, SkillCat, INC (“SkillCat”) does not warrant the existence or functionality of any website which can be accessed through a link located on this site.

7.2) Copyrights, Trademarks, and Other Proprietary Rights.

7.3) SkillCat, INC (“SkillCat”) or its third party content providers shall retain all worldwide rights in the intellectual property in and on the Site, including, but not limited to, trademarks, service marks, trade dress, inventions, ideas, trade secrets, the source code, the HTML code, the “look and feel” of the Site, its colour combinations, layout, and all other graphical elements, and the copyrights in and to its original content. You should assume that everything you read or see on the Site is copyrighted, trademarked, or otherwise protected and owned or licensed by SkillCat, INC (“SkillCat”).

7.4) Except as expressly stated on the Site or in these Terms, nothing that You read or see on the Site or in the courses may be copied, reproduced, modified, distributed, transmitted, republished, displayed or performed for commercial use without the prior written consent of SkillCat, INC (“SkillCat”), except as provided in these Terms. Nothing in these Terms grants you an express or implied license to use any of SkillCat, INC (“SkillCat”) intellectual property.

## 8) Disclaimers and Limitation of Liability

8.1) Users’ access this site at his/her/its own risk. The site is provided on an “as is, as available” basis without warranty of any kind, expressed, implied, or statutory, and any and all warranties of merchantability, fitness for a particular purpose, or non-infringement of third parties’ rights are specifically disclaimed. SkillCat, INC (“SkillCat”) does not warrant any particular result from the use of the software or site. SkillCat, INC (“SkillCat”) does not warrant that the information on the site is accurate, complete, or complies with any particular law or regulation, or that the operation of and your access to the site will be uninterrupted, error-free, virus-free or completely secure.

8.2) Under no circumstances and under no legal theory (tort, contract or otherwise) shall SkillCat, INC (“SkillCat”) or any of its affiliates, agents, employees, shareholders, directors, officers, third party content providers, successors or assigns be liable to you or any other person or entity for any indirect, special, incidental, punitive or consequential damages of any character, including without limitation, damages for loss of goodwill, work stoppage, computer failure or malfunction, loss of data, loss of productivity or contract, or any and all other commercial damages or losses.

8.3) Your use of this site is at your sole risk and any content that you download is downloaded at your own discretion and risk, and you are solely responsible for any damage to your computer system in excess of the amount SkillCat, INC (“SkillCat”) received from students for a course, and for any loss of data that results from the downloading of any such content, including any damages resulting from computer viruses.

8.4) In no event will SkillCat, INC (“SkillCat”) be liable for any damages in excess of the amount SkillCat, INC (“SkillCat”) received from the student for access to a course, even if SkillCat, INC (“SkillCat”) have been informed of the possibility of such damages, or for any claim by any other party.

8.5) In no event will warranties provided by law, if any, apply unless they are required to apply by statute notwithstanding their exclusion by contract.

8.6) This disclaimer is applicable to any damage or injury resulting from the negligence or an omission of SkillCat, INC (“SkillCat”), computer virus or other similar item, telecommunications errors, or unauthorized access to or use of user information through theft or any other means. SkillCat, INC (“SkillCat”) is not liable for criminal, tortious, or negligent actions or omissions of third parties that affect this site.

## 9) Confidentiality / Non-disclosure

9.1) As a result of the provision of our Services to you, and whether due to any intentional or negligent act or omission, we may disclose to you or you may otherwise learn of or discover, our documents, business practices, object code, source code, management styles, day-to-day business operations, capabilities, systems, current and future strategies, marketing information, financial information, software, technologies, processes, procedures, methods and applications, or other aspects of our business (“Information”).

9.2) You hereby agree and acknowledge that any and all of our information is confidential and shall be our sole and exclusive intellectual property and proprietary information.

9.3) You agree to use our Information only for the specific purposes as allowed in this TOS.

9.4) Any disclosure of our Information to a third party specifically including a direct competitor is strictly prohibited and will be vigorously challenged in a court of law.

9.5) All obligations contained herein shall survive the termination of this TOS.

9.6) Furthermore, you acknowledge that our information is proprietary, confidential, and extremely valuable to us, and that we would be materially damaged by your disclosure of our Information.

9.7) You acknowledge and agree that monetary damages provide an insufficient remedy for the breach of this confidentiality obligation and that we shall be entitled to injunctive relief.

## 10) Indemnification

10.1) You agree to indemnify and hold harmless SkillCat, INC (“SkillCat”), its contractors, and its licensors, and their respective directors, officers, employees and agents from and against any and all claims and expenses including attorneys’ fees, arising out of your use of the Website, including but not limited to your violation of the TOS.

## 11) Arbitration

11.1) Any dispute arising under this Agreement shall be resolved by arbitration by a single Arbitrator in Houston, Texas, USA in accordance with the then-current rules of the American Arbitration Association.

11.2) In the event that any party fails to submit any dispute arising from this agreement to mediation first, or fails to meaningfully participate in mediation, that party will not be entitled to attorney’s fees as provided in this paragraph.

11.3) Any judgment upon the award entered by the arbitrator may be entered in any court having jurisdiction.

11.4) Costs of arbitration, including reasonable attorney’s fees incurred in arbitration as determined by the Arbitrator, together with any reasonable attorney’s fees incurred by prevailing party in Court enforcement of the arbitration award after it is rendered by the Arbitrator, shall be paid to the prevailing party by the party designated by the Arbitrator or Court.

## 12) Anti-Discrimination Policy

12.1) Skillcat is committed to fostering a learning and working environment that is free from discrimination. We strictly prohibit any form of discrimination or harassment based on race, color, religion, gender, age, national origin, disability, sexual orientation, or any other status protected under applicable law. Our commitment extends to all aspects of our operations, including hiring practices, course development, instruction, and learner engagement within our Continuing Education and Training (CE/T) programs.

## 13) Intellectual Property Rights Policy

13.1) Skillcat is committed to upholding intellectual and legal property rights in the utilization of any copy-righted material within its Continuing Education and Training (CE/T) programs. This policy outlines the procedures for the ethical and lawful use of any copy-righted material, ensuring compliance with copyright laws.

## 14) Proprietary Interests

SkillCat enforces a strict policy that prohibits the discussion, promotion, or endorsement of any products, instruments, devices, or materials with proprietary interests within its Continuing Education and Training (CE/T) programs. This policy ensures that all training content and instructional activities conducted under SkillCat are free from commercial bias or conflicts of interest, upholding the integrity, objectivity, and educational value of our offerings.`;

const PRIVACY_POLICY_MD = `Last Updated: February 4, 2026

## 1. Introduction

SkillCat, INC ("SkillCat," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our websites (skillcatapp.com and skillcat.app), use our mobile applications, or access our online training and certification services (collectively, the "Services").

Please read this Privacy Policy carefully. By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access or use our Services.

## 2. Contact Information

SkillCat, INC
169 Madison Ave STE 15778
New York, NY 10016
Phone: (415) 707-8437
Email: [info@skillcatapp.com](mailto:info@skillcatapp.com)
Website: [www.skillcatapp.com](https://www.skillcatapp.com)

## 3. Information We Collect

### 3.1 Personal Information You Provide

When you register for an account, purchase a subscription, or use our Services, we may collect the following personal information: your first and last name; email address; phone number; company name; job title, focus, and level; state and country; payment information (processed through secure third-party payment processors); and account credentials (username and password).

### 3.2 Information Collected Automatically

When you access our Services, we automatically collect certain information, including: device information (device type, operating system, unique device identifiers); IP address and approximate geographic location; browser type and version; pages visited, time spent on pages, and navigation patterns; course progress, quiz scores, and certification completion data; app usage data and interaction with features; and referral URLs and how you arrived at our Services.

### 3.3 Cookies and Tracking Technologies

We use cookies, web beacons, pixels, and similar tracking technologies to collect information about your browsing activities. These technologies help us analyze trends, administer the website, track users' movements around the site, and gather demographic information. You can control cookies through your browser settings, though disabling cookies may affect your ability to use certain features of our Services.

### 3.4 Sensitive Personal Information

For certain certifications or identity verification requirements, we may collect limited sensitive personal information, such as a copy of a government-issued identification document (e.g., driver’s license, state ID, or passport). This information is used solely to verify your identity and eligibility for certifications. We do not collect Social Security numbers.

## 4. How We Use Your Information

We use the information we collect to: provide, maintain, and improve our Services; process transactions and send related information, including purchase confirmations and invoices; create and manage your account; deliver courses, track your progress, and issue certifications; send you technical notices, updates, security alerts, and support messages; respond to your comments, questions, and customer service requests; communicate with you about products, services, offers, and events we believe may interest you (with your consent where required); monitor and analyze trends, usage, and activities in connection with our Services; detect, investigate, and prevent fraudulent transactions and other illegal activities; personalize and improve your experience; and comply with legal obligations.

## 5. How We Share Your Information

We may share your information in the following circumstances:

**Service Providers:** We share information with third-party vendors, consultants, and service providers who perform services on our behalf, such as payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.

**Certification Verification:** With your consent, we may share certification information with employers, regulatory bodies, or other parties who need to verify your credentials.

**Business Partners:** We may share information with business partners who offer services that may be of interest to you, with your consent.

**Legal Requirements:** We may disclose information if required to do so by law or in response to valid requests by public authorities (e.g., court orders, subpoenas, or government regulations).

**Business Transfers:** In connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business, your information may be transferred as part of that transaction.

**Protection of Rights:** We may disclose information to protect the rights, property, or safety of SkillCat, our users, or others.

## 6. Data Retention

We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy any legal, accounting, or reporting requirements. Learner records, including certification and course completion data, are retained for a minimum of ten (10) years to comply with industry standards and to allow for credential verification. When we no longer need to retain your information, we will securely delete or anonymize it.

## 7. Data Security

We implement appropriate technical and organizational security measures designed to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption of data in transit and at rest, secure server infrastructure, access controls, and regular security assessments. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.

## 8. Your Rights and Choices

### 8.1 Account Information

You may update, correct, or delete your account information at any time by logging into your account settings or by contacting us at [info@skillcatapp.com](mailto:info@skillcatapp.com).

### 8.2 Marketing Communications

You may opt out of receiving promotional emails from us by following the unsubscribe instructions in those emails. If you opt out, we may still send you non-promotional communications, such as those about your account or our ongoing business relations.

### 8.3 Cookies

Most web browsers are set to accept cookies by default. You can usually modify your browser settings to remove or reject cookies. Please note that removing or rejecting cookies could affect the availability and functionality of our Services.

## 9. California Privacy Rights (CCPA/CPRA)

If you are a California resident, you have certain rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):

**Right to Know:** You have the right to request information about the categories and specific pieces of personal information we have collected about you, the categories of sources from which we collected the information, our purposes for collecting the information, and the categories of third parties with whom we share the information.

**Right to Delete:** You have the right to request deletion of your personal information, subject to certain exceptions.

**Right to Correct:** You have the right to request correction of inaccurate personal information.

**Right to Opt-Out:** You have the right to opt out of the sale or sharing of your personal information for cross-context behavioral advertising purposes.

**Right to Non-Discrimination:** We will not discriminate against you for exercising any of your CCPA/CPRA rights.

To exercise these rights, please contact us at [info@skillcatapp.com](mailto:info@skillcatapp.com) or call (415) 707-8437. We will verify your identity before processing your request.

**Do Not Sell or Share My Personal Information:** SkillCat does not sell personal information in the traditional sense. However, some of our advertising practices may constitute "sharing" under CCPA/CPRA. To opt out, please contact us or adjust your cookie preferences.

## 10. Children's Privacy

Our Services are not intended for children under the age of 16, and we do not knowingly collect personal information from children under 16. If we learn that we have collected personal information from a child under 16, we will take steps to delete that information as quickly as possible. If you believe we may have collected information from a child under 16, please contact us at [info@skillcatapp.com](mailto:info@skillcatapp.com).

## 11. Third-Party Links and Services

Our Services may contain links to third-party websites, services, or applications that are not operated by us. This Privacy Policy does not apply to those third-party services. We encourage you to review the privacy policies of any third-party services you access.

## 12. International Data Transfers

Your information may be transferred to and processed in countries other than the country in which you reside. These countries may have data protection laws that are different from the laws of your country. By using our Services, you consent to the transfer of your information to the United States and other countries where we operate.

## 13. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by posting the updated Privacy Policy on our website and updating the "Last Updated" date at the top of this policy. We may also notify you by email or through our Services. Your continued use of our Services after any changes to this Privacy Policy constitutes your acceptance of the updated policy.

## 14. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:

SkillCat, INC
169 Madison Ave STE 15778
New York, NY 10016
Email: [info@skillcatapp.com](mailto:info@skillcatapp.com)
Phone: (415) 707-8437`;

const TERMS_OF_SERVICE_ES_MD = `5925 Almeda Road, Unidad 12018
Houston, TX 77004
Tel.: (415) 707-8437
[www.skillcatapp.com](https://www.skillcatapp.com)

SkillCat, INC (“SkillCat”) es una empresa registrada con domicilio social en 5925 Almeda Road, Unidad 12018, Houston, TX 77004. SkillCat, INC (“SkillCat”) es propietaria de [www.skillcatapp.com](https://www.skillcatapp.com) y [www.skillcat.app](https://www.skillcat.app). Los siguientes términos y condiciones (“TOS”) rigen todo uso de los sitios web skillcatapp.com y skillcat.app (el “Sitio Web”) y de todo el contenido, los servicios y los productos disponibles en o a través del Sitio Web (los “Servicios”). Este es un contrato con SkillCat, INC (“SkillCat”). Por favor, lea atentamente los siguientes términos antes de acceder a este sitio o utilizar un curso.

Al acceder al sitio (lo que incluye visitar, registrarse, comprar o acceder a un curso), usted acepta y consiente todos los convenios y condiciones establecidos en este acuerdo. Si no está de acuerdo con estos términos, no podrá acceder al sitio. Al utilizar este servicio, usted confirma que ha leído, comprende y acepta estos términos. También acepta revisar este Acuerdo periódicamente para estar al tanto de las modificaciones del mismo, las cuales SkillCat, INC (“SkillCat”) puede realizar en cualquier momento. El uso continuado de este sitio se considerará como su aceptación definitiva de cualquier versión modificada del acuerdo.

## 1) Generalidades

1.1) SkillCat, INC (“SkillCat”) se reserva el derecho de modificar el contenido utilizado en cualquier momento.

1.2) Los estudiantes que se inscriban en un curso tienen acceso de por vida a los certificados obtenidos.

1.3) Se reservan todos los derechos no otorgados expresamente en el presente documento.

1.4) Estos Términos y Condiciones se regirán e interpretarán de conformidad con las leyes de Houston, Texas, Estados Unidos de América.

1.5) Si no está de acuerdo con estos Términos y Condiciones, debe abandonar el curso inmediatamente y notificar a SkillCat, INC (“SkillCat”) su intención de no continuar.

## 2) Su cuenta de SkillCat

2.1) Una cuenta registrada (“Cuenta”) es el área de nuestro sitio web a la que se accede mediante una contraseña y que contiene información personal del usuario.

2.2) Usted es responsable de mantener la seguridad de su Cuenta y es plenamente responsable de todas las actividades que se realicen a través de ella, así como de cualquier otra acción llevada a cabo en relación con la misma.

2.3) Debe notificar inmediatamente a SkillCat, INC (“SkillCat”) cualquier uso no autorizado de su Cuenta o cualquier otra brecha de seguridad.

2.4) SkillCat, INC (“SkillCat”) no será responsable de ningún acto u omisión por su parte, incluidos los daños de cualquier tipo que se deriven de dichos actos u omisiones.

2.5) El registro de un usuario requiere que este proporcione una dirección de correo electrónico válida para la comunicación entre eLearning Industry y el usuario, así como un nombre válido, entre otra información requerida de conformidad con la Sección 6.4.a más adelante.

## 3) Política de cancelación

3.1) Si un estudiante no puede acceder al curso en línea a través de SkillCat.App por no cumplir con los requisitos del sistema especificados en el sitio web.

## 4) Materiales de e-Learning

4.1) El material de formación es propiedad de SkillCat, INC (“SkillCat”).

4.2) Este material de formación ha sido preparado, mantenido, actualizado y distribuido por SkillCat, INC (“SkillCat”).

4.3) El uso del material de formación de nuestros cursos está restringido al Usuario Registrado que haya recibido los datos de acceso por parte de un Proveedor de Servicios de Formación como parte de un curso autorizado.

4.4) El Usuario Registrado no podrá copiar, compartir, modificar, transmitir, distribuir ni explotar de ninguna manera los materiales protegidos por derechos de autor proporcionados por SkillCat, INC (“SkillCat”), salvo para su propia formación individual. El uso para cualquier otro fin está expresamente prohibido por ley y los infractores serán objeto de acciones legales.

4.5) El Usuario Registrado no permitirá que ninguna otra persona copie, utilice, modifique, transmita, distribuya ni explote de ninguna manera los materiales protegidos por derechos de autor.

4.6) Los materiales puestos a disposición por SkillCat, INC (“SkillCat”) se suministran “tal cual”, sin garantías de ningún tipo, ya sean expresas o implícitas, incluidas, entre otras, todas las garantías implícitas de comerciabilidad, idoneidad para un fin determinado, titularidad o ausencia de infracción.

4.7) SkillCat, INC (“SkillCat”) no garantiza que los materiales estén libres de errores (incluidas inexactitudes técnicas) ni de virus u otros elementos perjudiciales. El coste total de cualquier servicio, reparación o corrección necesaria correrá a cargo del Usuario Registrado.

4.8) SkillCat, INC (“SkillCat”) podrá realizar mejoras o cambios en este material en cualquier momento y sin previo aviso.

4.9) Todas las demás marcas comerciales, marcas de servicio y nombres comerciales que aparecen en este material son propiedad de sus respectivos titulares; queda prohibido cualquier uso no autorizado de los mismos.

4.10) Quedan reservados todos los derechos no concedidos expresamente en el presente documento.

4.11) Estos Términos y Condiciones se regirán e interpretarán de conformidad con las leyes de Houston, Texas, Estados Unidos de América.

4.12) Si no está de acuerdo con estos Términos y Condiciones, debe dejar de utilizar el sistema de aprendizaje en línea (e-learning) de inmediato.

## 5) Acceso a los cursos

5.1) SkillCat, INC (“SkillCat”) se esfuerza por proporcionar el contenido de los cursos a sus estudiantes de manera continua. Con este fin, SkillCat, INC (“SkillCat”) realizará todos los esfuerzos comercialmente razonables para brindar a sus estudiantes acceso ininterrumpido a los cursos. Sin embargo, en ocasiones, es posible que los estudiantes no puedan acceder a los cursos debido a condiciones ajenas al control de SkillCat, INC (“SkillCat”). Dichas condiciones incluyen, entre otras, fuerza mayor, causas de fuerza mayor (actos de la naturaleza), cortes de energía y acciones de piratas informáticos u otros actores que actúen al margen de la ley. Asimismo, el acceso podría no estar disponible ocasionalmente debido a problemas de software, tiempo de inactividad del servidor, aumento del tráfico de Internet o interrupciones en la red, errores de programación, mantenimiento periódico del sistema y otras razones conexas. Ante cualquier falta de disponibilidad de los cursos para sus estudiantes, SkillCat, INC (“SkillCat”) tomará todas las medidas comercialmente razonables para garantizar que se restablezca el acceso en un plazo razonable. El término “comercialmente razonable”, tal como se utiliza en estos Términos, se refiere a los esfuerzos razonables realizados de buena fe, sin incurrir en un uso o gasto excesivo o gravoso de tiempo, recursos, personal o dinero.

5.2) SkillCat, INC (“SkillCat”) se esfuerza por ofrecer contenido de la más alta calidad a sus estudiantes. A tal efecto, SkillCat, INC (“SkillCat”) se reserva el derecho, a su entera discreción, de cambiar, modificar o discontinuar cualquier aspecto o característica de este Sitio, ya sea total o parcialmente, incluyendo, sin limitación, el contenido, la disponibilidad, el acceso y/o los Términos de este Sitio. Dichos cambios, modificaciones, adiciones o eliminaciones entrarán en vigor inmediatamente tras su notificación, la cual podrá realizarse mediante la publicación de tales cambios en este Sitio.

5.3) Los usuarios son los únicos responsables de asegurarse de contar con el hardware, el software, los equipos de telecomunicaciones y el servicio de Internet suficientes y compatibles necesarios para utilizar el Sitio.

## 6) Registro/Alta

6.1) El contenido publicado en SkillCat, INC (“SkillCat”) es accesible para todos los visitantes. Sin embargo, ciertas funciones y servicios pueden requerir registro. Los usuarios pueden registrarse (“Crear nueva cuenta”) en el sitio (por ejemplo, en https://skillcat.app/login/index.php?). Al registrarse, se crea una cuenta para el usuario. Los usuarios que se registran en el sitio deben confirmar su registro haciendo clic en un enlace de activación enviado por correo electrónico. Todas las cuentas de usuario activas tienen la capacidad de ver los materiales del curso.

Se requiere que los usuarios proporcionen parte o la totalidad de la siguiente información:

1. Nombre y apellidos
2. Dirección de correo electrónico
3. Nombre de la empresa, estado y país
4. Cargo, área de especialización y nivel
5. Teléfono del trabajo
6. SkillCat, INC (“SkillCat”) se reserva el derecho de rechazar cualquier solicitud de registro a su entera discreción.

Una vez que SkillCat, INC (“SkillCat”) reciba su solicitud de registro, creará una cuenta para usted en nuestro sitio web y le enviará por correo electrónico un enlace para activar su cuenta. Al acceder al enlace, se le pedirá que establezca una contraseña y acepte estos Términos de Uso (TOU). Una vez completada la activación, podrá crear su perfil (“Perfil”).

Cada cuenta es personal e intransferible. Sus derechos y obligaciones con respecto a SkillCat también son intransferibles. Usted es plenamente responsable de todas las actividades que tengan lugar bajo esta cuenta y de cualquier otra acción realizada en relación con la misma. Debe notificar inmediatamente a SkillCat, INC (“SkillCat”) a través de [info@skillcatapp.com](mailto:info@skillcatapp.com) sobre cualquier uso no autorizado de su cuenta o cualquier otra brecha de seguridad. SkillCat, INC (“SkillCat”) no será responsable de ningún acto u omisión por su parte, incluidos los daños de cualquier tipo incurridos como resultado de dichos actos u omisiones.

## 7) Contenido de terceros; Hipervínculos

7.1) SkillCat, INC (“SkillCat”) no ofrece garantía alguna, ya sea expresa o implícita, sobre la exactitud, comerciabilidad, idoneidad para un fin determinado o la no infracción de derechos respecto a la información proporcionada por terceros. Esto incluye, entre otros, cualquier información que se encuentre en un enlace situado en este sitio que permita a los usuarios acceder a información alojada en otro sitio. Asimismo, SkillCat, INC (“SkillCat”) no garantiza la existencia ni el funcionamiento de ningún sitio web al que se pueda acceder a través de un enlace situado en este sitio.

7.2) Derechos de autor, marcas comerciales y otros derechos de propiedad.

7.3) SkillCat, INC (“SkillCat”) o sus proveedores de contenido externos conservarán todos los derechos de propiedad intelectual a nivel mundial sobre el Sitio y su contenido, incluyendo, entre otros: marcas comerciales, marcas de servicio, imagen comercial (*trade dress*), invenciones, ideas, secretos comerciales, el código fuente, el código HTML, la apariencia y estilo (*look and feel*) del Sitio, sus combinaciones de colores, la disposición de los elementos y demás componentes gráficos, así como los derechos de autor sobre su contenido original. Usted debe asumir que todo lo que lea o vea en el Sitio está protegido por derechos de autor, marcas comerciales u otras formas de protección, y que es propiedad de SkillCat, INC (“SkillCat”) o cuenta con la licencia correspondiente de dicha entidad.

7.4) Salvo que se indique expresamente lo contrario en el Sitio o en las presentes Condiciones, ningún elemento que usted lea o vea en el Sitio o en los cursos podrá ser copiado, reproducido, modificado, distribuido, transmitido, republicado, exhibido ni utilizado con fines comerciales sin el consentimiento previo por escrito de SkillCat, INC (“SkillCat”), salvo en los casos previstos en estas Condiciones. Ninguna disposición de estas Condiciones le otorga una licencia, expresa o implícita, para utilizar la propiedad intelectual de SkillCat, INC (“SkillCat”).

## 8) Exenciones de responsabilidad y limitación de responsabilidad

8.1) Los usuarios acceden a este sitio bajo su propio riesgo. El sitio se proporciona “tal cual” y “según disponibilidad”, sin garantías de ningún tipo, ya sean expresas, implícitas o legales; se excluyen expresamente todas las garantías de comerciabilidad, idoneidad para un fin determinado o no infracción de derechos de terceros. SkillCat, INC (“SkillCat”) no garantiza ningún resultado concreto derivado del uso del software o del sitio. SkillCat, INC (“SkillCat”) no garantiza que la información contenida en el sitio sea precisa o completa, ni que cumpla con leyes o normativas específicas, ni que el funcionamiento del sitio y su acceso al mismo sean ininterrumpidos, estén libres de errores o virus, o sean totalmente seguros.

8.2) Bajo ninguna circunstancia ni teoría jurídica (responsabilidad extracontractual, contractual o de otro tipo) SkillCat, INC (“SkillCat”) ni ninguna de sus filiales, agentes, empleados, accionistas, directores, funcionarios, proveedores de contenido externos, sucesores o cesionarios serán responsables ante usted o ante cualquier otra persona o entidad por daños indirectos, especiales, incidentales, punitivos o consecuentes de cualquier naturaleza, incluidos, entre otros, daños por pérdida de reputación comercial, interrupción de la actividad laboral, fallo o mal funcionamiento informático, pérdida de datos, pérdida de productividad o de contratos, o cualquier otro daño o pérdida comercial.

8.3) El uso de este sitio corre exclusivamente por su cuenta y riesgo; la descarga de cualquier contenido se realiza a su propia discreción y riesgo, y usted es el único responsable de cualquier daño en su sistema informático que exceda el importe que SkillCat, INC (“SkillCat”) haya recibido de los estudiantes por un curso, así como de cualquier pérdida de datos derivada de la descarga de dicho contenido, incluidos los daños causados por virus informáticos.

8.4) En ningún caso SkillCat, INC (“SkillCat”) será responsable de daños que excedan el monto que SkillCat, INC (“SkillCat”) recibió del estudiante por el acceso a un curso, incluso si SkillCat, INC (“SkillCat”) hubiera sido informada de la posibilidad de tales daños, ni de reclamaciones presentadas por terceros.

8.5) En ningún caso se aplicarán las garantías establecidas por ley, si las hubiera, a menos que su aplicación sea obligatoria por ley, independientemente de su exclusión contractual.

8.6) Esta exención de responsabilidad se aplica a cualquier daño o perjuicio resultante de la negligencia o una omisión de SkillCat, INC (“SkillCat”), virus informáticos u otros elementos similares, errores de telecomunicaciones o el acceso o uso no autorizado de información del usuario mediante robo o cualquier otro medio. SkillCat, INC (“SkillCat”) no es responsable de acciones u omisiones delictivas, ilícitas o negligentes de terceros que afecten a este sitio.

## 9) Confidencialidad / No divulgación

9.1) Como resultado de la prestación de nuestros Servicios, y ya sea debido a un acto u omisión intencional o negligente, es posible que le divulguemos, o que usted conozca o descubra por otros medios, nuestros documentos, prácticas comerciales, código objeto, código fuente, estilos de gestión, operaciones comerciales cotidianas, capacidades, sistemas, estrategias actuales y futuras, información de marketing, información financiera, software, tecnologías, procesos, procedimientos, métodos y aplicaciones, u otros aspectos de nuestro negocio (la “Información”).

9.2) Por la presente, usted acepta y reconoce que toda nuestra Información es confidencial y constituirá nuestra única y exclusiva propiedad intelectual e información de propiedad exclusiva.

9.3) Usted se compromete a utilizar nuestra Información únicamente para los fines específicos permitidos en estos Términos de Servicio (TOS).

9.4) Queda estrictamente prohibida cualquier divulgación de nuestra Información a terceros, incluyendo específicamente a competidores directos, y dicha acción será impugnada enérgicamente ante los tribunales.

9.5) Todas las obligaciones aquí contenidas permanecerán vigentes tras la terminación de estos Términos de Servicio (TOS).

9.6) Asimismo, usted reconoce que nuestra información es de nuestra propiedad, confidencial y de gran valor para nosotros, y que sufriríamos un perjuicio sustancial si usted divulgara dicha información.

9.7) Usted reconoce y acepta que una indemnización económica constituye un remedio insuficiente ante el incumplimiento de esta obligación de confidencialidad y que tendremos derecho a solicitar medidas cautelares o de prohibición (injunctive relief).

## 10) Indemnización

10.1) Usted acepta indemnizar y eximir de responsabilidad a SkillCat, INC (“SkillCat”), a sus contratistas y licenciantes, así como a sus respectivos directores, funcionarios, empleados y agentes, frente a cualquier reclamación y gasto —incluidos los honorarios de abogados— que surjan de su uso del Sitio Web, lo que incluye, entre otros supuestos, el incumplimiento por su parte de los Términos de Servicio (TOS).

## 11) Arbitraje

11.1) Cualquier controversia derivada del presente Acuerdo se resolverá mediante arbitraje a cargo de un árbitro único en Houston, Texas (EE. UU.), de conformidad con las normas vigentes de la Asociación Americana de Arbitraje (American Arbitration Association).

11.2) En caso de que alguna de las partes no someta previamente a mediación cualquier controversia derivada de este acuerdo, o no participe de manera efectiva en dicha mediación, no tendrá derecho a reclamar honorarios de abogados según lo dispuesto en este párrafo.

11.3) El laudo dictado por el árbitro podrá ser objeto de ejecución ante cualquier tribunal competente.

11.4) Los costes del arbitraje —incluidos los honorarios razonables de abogados incurridos durante el mismo, según determine el árbitro—, así como los honorarios razonables de abogados en los que incurra la parte vencedora para la ejecución judicial del laudo arbitral una vez dictado, serán abonados a dicha parte vencedora por la parte designada por el árbitro o el tribunal.

## 12) Política contra la discriminación

12.1) SkillCat se compromete a fomentar un entorno de aprendizaje y trabajo libre de discriminación. Prohibimos estrictamente cualquier forma de discriminación o acoso por motivos de raza, color, religión, género, edad, origen nacional, discapacidad, orientación sexual o cualquier otra condición protegida por la legislación aplicable. Nuestro compromiso abarca todos los aspectos de nuestras operaciones, incluidas las prácticas de contratación, el desarrollo de cursos, la impartición de formación y la interacción con los alumnos en el marco de nuestros programas de Educación Continua y Formación (CE/T).

## 13) Política de derechos de propiedad intelectual

13.1) SkillCat se compromete a respetar los derechos de propiedad intelectual y legal en el uso de cualquier material protegido por derechos de autor dentro de sus programas de Educación Continua y Capacitación (CE/T). Esta política establece los procedimientos para el uso ético y legal de dicho material, garantizando el cumplimiento de las leyes de derechos de autor.

## 14) Intereses de propiedad

SkillCat aplica una política estricta que prohíbe debatir, promocionar o respaldar productos, instrumentos, dispositivos o materiales sujetos a intereses de propiedad dentro de sus programas de Educación Continua y Capacitación (CE/T). Esta política garantiza que todo el contenido de capacitación y las actividades formativas realizadas por SkillCat estén libres de sesgos comerciales o conflictos de intereses, preservando así la integridad, la objetividad y el valor educativo de nuestra oferta.`;

const PRIVACY_POLICY_ES_MD = `Última actualización: 4 de febrero de 2026

## 1. Introducción

SkillCat, INC («SkillCat», «nosotros» o «nuestro») se compromete a proteger su privacidad. Esta Política de privacidad explica cómo recopilamos, utilizamos, divulgamos y protegemos su información cuando visita nuestros sitios web (skillcatapp.com y skillcat.app), utiliza nuestras aplicaciones móviles o accede a nuestros servicios de formación y certificación en línea (denominados colectivamente los «Servicios»).

Por favor, lea atentamente esta Política de privacidad. Al acceder a nuestros Servicios o utilizarlos, usted reconoce que ha leído y comprendido esta Política de privacidad y acepta quedar vinculado por ella. Si no está de acuerdo con los términos de esta Política de privacidad, le rogamos que no acceda a nuestros Servicios ni los utilice.

## 2. Información de contacto

SkillCat, INC
169 Madison Ave STE 15778
New York, NY 10016
Teléfono: (415) 707-8437
Correo electrónico: [info@skillcatapp.com](mailto:info@skillcatapp.com)
Sitio web: [www.skillcatapp.com](https://www.skillcatapp.com)

## 3. Información que recopilamos

### 3.1 Información personal que usted proporciona

Cuando crea una cuenta, adquiere una suscripción o utiliza nuestros Servicios, podemos recopilar la siguiente información personal: su nombre y apellidos; dirección de correo electrónico; número de teléfono; nombre de la empresa; cargo, área de especialización y nivel profesional; estado y país; información de pago (procesada a través de proveedores de servicios de pago externos seguros); y credenciales de la cuenta (nombre de usuario y contraseña).

### 3.2 Información recopilada automáticamente

Cuando accede a nuestros Servicios, recopilamos automáticamente cierta información, que incluye: información del dispositivo (tipo de dispositivo, sistema operativo, identificadores únicos del dispositivo); dirección IP y ubicación geográfica aproximada; tipo y versión del navegador; páginas visitadas, tiempo de permanencia en las páginas y patrones de navegación; progreso en los cursos, puntuaciones de cuestionarios y datos de finalización de certificaciones; datos de uso de la aplicación e interacción con las funciones; y URL de referencia y la forma en que llegó a nuestros Servicios.

### 3.3 Cookies y tecnologías de seguimiento

Utilizamos cookies, balizas web (web beacons), píxeles y tecnologías de seguimiento similares para recopilar información sobre sus actividades de navegación. Estas tecnologías nos ayudan a analizar tendencias, administrar el sitio web, rastrear los movimientos de los usuarios por el sitio y recopilar información demográfica. Puede controlar las cookies a través de la configuración de su navegador; no obstante, desactivarlas podría afectar su capacidad para utilizar ciertas funciones de nuestros Servicios.

### 3.4 Información personal sensible

Para determinadas certificaciones o requisitos de verificación de identidad, es posible que recopilemos información personal sensible limitada, como una copia de un documento de identidad oficial (por ejemplo, licencia de conducir, identificación estatal o pasaporte). Esta información se utiliza exclusivamente para verificar su identidad y su elegibilidad para las certificaciones. No recopilamos números de Seguro Social.

## 4. Cómo utilizamos su información

Utilizamos la información que recopilamos para: proporcionar, mantener y mejorar nuestros Servicios; procesar transacciones y enviar información relacionada, incluidas confirmaciones de compra y facturas; crear y gestionar su cuenta; impartir cursos, realizar un seguimiento de su progreso y emitir certificaciones; enviarle avisos técnicos, actualizaciones, alertas de seguridad y mensajes de soporte; responder a sus comentarios, preguntas y solicitudes de atención al cliente; comunicarnos con usted sobre productos, servicios, ofertas y eventos que consideremos puedan interesarle (con su consentimiento, cuando así se requiera); monitorear y analizar tendencias, uso y actividades relacionados con nuestros Servicios; detectar, investigar y prevenir transacciones fraudulentas y otras actividades ilegales; personalizar y mejorar su experiencia; y cumplir con obligaciones legales.

## 5. Cómo compartimos su información

Podemos compartir su información en las siguientes circunstancias:

**Proveedores de servicios:** Compartimos información con proveedores externos, consultores y prestadores de servicios que realizan tareas en nuestro nombre, tales como procesamiento de pagos, análisis de datos, envío de correos electrónicos, servicios de alojamiento (hosting), atención al cliente y asistencia en marketing.

**Verificación de certificaciones:** Con su consentimiento, podemos compartir información sobre certificaciones con empleadores, organismos reguladores u otras partes que necesiten verificar sus credenciales.

**Socios comerciales:** Podemos compartir información con socios comerciales que ofrezcan servicios que puedan ser de su interés, siempre que contemos con su consentimiento.

**Requisitos legales:** Podemos divulgar información si así lo exige la ley o en respuesta a solicitudes válidas de autoridades públicas (por ejemplo, órdenes judiciales, citaciones o normativas gubernamentales).

**Transferencias empresariales:** En relación con cualquier fusión, venta de activos de la empresa, financiación o adquisición de la totalidad o una parte de nuestro negocio, su información podría transferirse como parte de dicha transacción.

**Protección de derechos:** Podemos divulgar información para proteger los derechos, la propiedad o la seguridad de SkillCat, de nuestros usuarios o de terceros.

## 6. Retención de datos

Conservamos su información personal durante el tiempo necesario para cumplir con los fines para los que se recopiló, incluido el cumplimiento de cualquier requisito legal, contable o de presentación de informes. Los registros de los alumnos, incluidos los datos de certificación y de finalización de cursos, se conservan durante un mínimo de diez (10) años para cumplir con los estándares del sector y permitir la verificación de credenciales. Cuando ya no necesitemos conservar su información, la eliminaremos o anonimizaremos de forma segura.

## 7. Seguridad de los datos

Implementamos medidas de seguridad técnicas y organizativas adecuadas, diseñadas para proteger su información personal contra el acceso, la alteración, la divulgación o la destrucción no autorizados. Estas medidas incluyen el cifrado de datos en tránsito y en reposo, una infraestructura de servidores segura, controles de acceso y evaluaciones de seguridad periódicas. Sin embargo, ningún método de transmisión por Internet o de almacenamiento electrónico es 100 % seguro, por lo que no podemos garantizar una seguridad absoluta.

## 8. Sus derechos y opciones

### 8.1 Información de la cuenta

Puede actualizar, corregir o eliminar la información de su cuenta en cualquier momento accediendo a la configuración de su cuenta o poniéndose en contacto con nosotros en [info@skillcatapp.com](mailto:info@skillcatapp.com).

### 8.2 Comunicaciones de marketing

Puede optar por no recibir correos electrónicos promocionales nuestros siguiendo las instrucciones para cancelar la suscripción que figuran en dichos correos. Si decide no recibirlos, es posible que sigamos enviándole comunicaciones no promocionales, como aquellas relacionadas con su cuenta o con nuestras relaciones comerciales en curso.

### 8.3 Cookies

La mayoría de los navegadores web están configurados para aceptar cookies de forma predeterminada. Por lo general, puede modificar la configuración de su navegador para eliminar o rechazar las cookies. Tenga en cuenta que eliminar o rechazar las cookies podría afectar a la disponibilidad y funcionalidad de nuestros Servicios.

## 9. Derechos de privacidad de California (CCPA/CPRA)

Si reside en California, tiene ciertos derechos en virtud de la Ley de Privacidad del Consumidor de California (CCPA) y la Ley de Derechos de Privacidad de California (CPRA):

**Derecho a saber:** Tiene derecho a solicitar información sobre las categorías y los elementos específicos de información personal que hemos recopilado sobre usted, las categorías de fuentes de las que obtuvimos dicha información, los fines de la recopilación y las categorías de terceros con los que compartimos la información.

**Derecho de supresión:** Usted tiene derecho a solicitar la eliminación de su información personal, sujeto a ciertas excepciones.

**Derecho de rectificación:** Usted tiene derecho a solicitar la corrección de información personal inexacta.

**Derecho a oponerse (opt-out):** Usted tiene derecho a oponerse a la venta o el intercambio de su información personal con fines de publicidad conductual entre contextos.

**Derecho a la no discriminación:** No le discriminaremos por ejercer ninguno de sus derechos bajo la CCPA o la CPRA.

Para ejercer estos derechos, por favor contáctenos en [info@skillcatapp.com](mailto:info@skillcatapp.com) o llame al (415) 707-8437. Verificaremos su identidad antes de procesar su solicitud.

**No vender ni compartir mi información personal:** SkillCat no vende información personal en el sentido tradicional. Sin embargo, algunas de nuestras prácticas publicitarias pueden constituir "compartir" información según la CCPA/CPRA. Para optar por no participar, por favor contáctenos o ajuste sus preferencias de cookies.

## 10. Privacidad de los niños

Nuestros Servicios no están dirigidos a niños menores de 16 años, y no recopilamos conscientemente información personal de niños menores de 16 años. Si descubrimos que hemos recopilado información personal de un niño menor de 16 años, tomaremos medidas para eliminar dicha información lo antes posible. Si cree que podemos haber recopilado información de un niño menor de 16 años, por favor contáctenos en [info@skillcatapp.com](mailto:info@skillcatapp.com).

## 11. Enlaces y servicios de terceros

Nuestros Servicios pueden contener enlaces a sitios web, servicios o aplicaciones de terceros que no son operados por nosotros. Esta Política de Privacidad no se aplica a dichos servicios de terceros. Le recomendamos que revise las políticas de privacidad de cualquier servicio de terceros al que acceda.

## 12. Transferencias internacionales de datos

Su información puede ser transferida y procesada en países distintos de aquel en el que reside. Es posible que estos países tengan leyes de protección de datos diferentes a las de su país. Al utilizar nuestros Servicios, usted consiente la transferencia de su información a los Estados Unidos y a otros países donde operamos.

## 13. Cambios en esta Política de privacidad

Podemos actualizar esta Política de privacidad periódicamente. Si realizamos cambios sustanciales, le notificaremos publicando la Política de privacidad actualizada en nuestro sitio web y actualizando la fecha de "Última actualización" que aparece al principio de esta política. También podemos notificarle por correo electrónico o a través de nuestros Servicios. El uso continuado de nuestros Servicios tras cualquier cambio en esta Política de privacidad constituye su aceptación de la política actualizada.

## 14. Contáctenos

Si tiene alguna pregunta, inquietud o solicitud relacionada con esta Política de privacidad o con nuestras prácticas de privacidad, por favor contáctenos en:

SkillCat, INC
169 Madison Ave STE 15778
New York, NY 10016
Correo electrónico: [info@skillcatapp.com](mailto:info@skillcatapp.com)
Teléfono: (415) 707-8437`;

export const DEFAULT_TERMS_OF_SERVICE_EN = markdownToHtml(TERMS_OF_SERVICE_MD);
export const DEFAULT_TERMS_OF_SERVICE_ES = markdownToHtml(TERMS_OF_SERVICE_ES_MD);
export const DEFAULT_PRIVACY_POLICY_EN = markdownToHtml(PRIVACY_POLICY_MD);
export const DEFAULT_PRIVACY_POLICY_ES = markdownToHtml(PRIVACY_POLICY_ES_MD);
