from peewee import *
from playhouse.sqlite_ext import JSONField
database = SqliteDatabase('configs.db')
import json

class BaseModel(Model):
  class Meta:
    database = database

class Config(BaseModel):
  contact = CharField(null=True)
  description = CharField(null=True)
  entry = CharField()

  def to_dict(self):
    r = {}
    for k in self._data.keys():
      r[k] = getattr(self, k)
    return r