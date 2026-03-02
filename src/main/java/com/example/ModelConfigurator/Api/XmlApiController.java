package com.example.ModelConfigurator.Api;

import com.example.ModelConfigurator.Core.dto.XmlNodeDto;
import com.example.ModelConfigurator.Core.dto.XmlTreeService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Controller
public class XmlApiController {

    private final XmlTreeService xmlService;

    public XmlApiController(XmlTreeService xmlService) {
        this.xmlService = xmlService;
    }

    @GetMapping("/")
    public String editorPage() {
        return "editor";
    }

    @PostMapping(value = "/api/xml/load", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public XmlNodeDto load(@RequestParam("file") MultipartFile file) throws Exception {
        return xmlService.parse(file.getBytes());
    }

    @PostMapping(value = "/api/xml/save", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> save(@Valid @RequestBody XmlNodeDto root,
                                       @RequestParam(defaultValue = "edited.xml") String name) {

        String xml = xmlService.toXml(root);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.getBytes());
    }
}