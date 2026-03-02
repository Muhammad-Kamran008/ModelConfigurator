package com.example.ModelConfigurator.Core.dto;

import org.springframework.stereotype.Service;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.*;
import java.util.LinkedHashMap;

@Service
public class XmlTreeService {

    public XmlNodeDto parse(byte[] xmlBytes) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xmlBytes));

            return fromElement(doc.getDocumentElement());

        } catch (Exception e) {
            throw new RuntimeException("Invalid XML", e);
        }
    }

    private XmlNodeDto fromElement(Element element) {
        XmlNodeDto dto = new XmlNodeDto(element.getTagName());

        NamedNodeMap attrs = element.getAttributes();
        LinkedHashMap<String, String> attrMap = new LinkedHashMap<>();
        for (int i = 0; i < attrs.getLength(); i++) {
            Node node = attrs.item(i);
            attrMap.put(node.getNodeName(), node.getNodeValue());
        }
        dto.setAttributes(attrMap);

        NodeList list = element.getChildNodes();
        boolean hasChildren = false;

        for (int i = 0; i < list.getLength(); i++) {
            Node node = list.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE) {
                hasChildren = true;
                dto.getChildren().add(fromElement((Element) node));
            }
        }

        if (!hasChildren) {
            dto.setText(element.getTextContent().trim());
        }

        return dto;
    }

    public String toXml(XmlNodeDto rootDto) {
        try {
            DocumentBuilder builder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            Document doc = builder.newDocument();

            Element root = toElement(doc, rootDto);
            doc.appendChild(root);

            Transformer transformer = TransformerFactory.newInstance().newTransformer();
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");

            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(doc), new StreamResult(writer));

            return writer.toString();

        } catch (Exception e) {
            throw new RuntimeException("XML generation failed", e);
        }
    }

    private Element toElement(Document doc, XmlNodeDto dto) {
        Element el = doc.createElement(dto.getTag());

        dto.getAttributes().forEach(el::setAttribute);

        if (dto.getChildren() != null && !dto.getChildren().isEmpty()) {
            for (XmlNodeDto child : dto.getChildren()) {
                el.appendChild(toElement(doc, child));
            }
        } else {
            el.setTextContent(dto.getText() == null ? "" : dto.getText());
        }

        return el;
    }
}