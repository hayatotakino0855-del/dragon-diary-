"""API入出力のPydanticスキーマ。"""
from typing import Optional

from pydantic import BaseModel

CHAR_TYPES = ("bilateral", "bilateral_with_sub", "unilateral", "weight",
              "visual", "measured")


class CompanyIn(BaseModel):
    name: str
    note: str = ""


class ProductIn(BaseModel):
    company_id: int
    part_no: str
    drawing_no: str = ""
    material: str = ""
    container_qty_note: str = ""
    frequency_note: str = ""


class CharacteristicIn(BaseModel):
    number: Optional[int] = None
    name: str
    type: str
    center_value: str = ""
    tolerance: str = ""
    unit: str = ""
    sub_name: str = ""
    sub_tolerance: str = ""
    criteria: str = ""
    axis_step: Optional[float] = None
    axis_range: Optional[float] = None


class TemplateIn(BaseModel):
    name: str
    sheet_name: str = ""
    special_notes: str = ""
    date_label: str = ""
    author: str = ""
    characteristics: list[CharacteristicIn] = []


class CharMasterIn(BaseModel):
    name: str
    type: str
    center_value: str = ""
    tolerance: str = ""
    unit: str = ""
    sub_name: str = ""
    sub_tolerance: str = ""
    criteria: str = ""
